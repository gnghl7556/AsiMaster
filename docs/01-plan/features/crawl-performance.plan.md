# 크롤링 성능 개선 Planning Document

> **Summary**: 크롤링 성능(병렬화, 연결 풀링)과 정확도(모델코드 매칭, 블랙리스트)를 함께 개선한다.
>
> **Project**: AsiMaster
> **Author**: Claude Code
> **Date**: 2026-02-21
> **Status**: Draft

---

## 1. Overview

### 1.1 Purpose

현재 크롤링 시스템은 (1) 순차 처리로 속도가 느리고 (2) 검색 결과에 관련 없는 상품이 섞여 최저가/순위 비교가 부정확하다. 병렬화로 속도를 개선하고, 모델코드 매칭 + 블랙리스트로 경쟁사 필터링 정확도를 높인다.

### 1.2 Background

**현재 문제점 분석:**

| 문제 | 위치 | 영향 |
|------|------|------|
| 키워드 순차 처리 | `manager.py:crawl_product()` | 키워드 3개 × 지연 2~5s = 최소 4~10s 대기 |
| 상품 순차 처리 | `manager.py:crawl_user_all()` | 상품 N개 × 위 시간 = 전체 크롤링 매우 느림 |
| 매 요청마다 httpx 클라이언트 생성 | `naver.py:search_keyword()` | TCP 연결 매번 새로 수립 → 불필요한 오버헤드 |
| 동일 키워드 중복 크롤링 | `manager.py` | 여러 상품에 같은 키워드가 있으면 중복 API 호출 |
| 관련 없는 상품이 경쟁사에 포함 | `manager.py:crawl_keyword()` | 모든 검색 결과를 무조건 경쟁사 취급 → 최저가 비교 부정확 |
| 블랙리스트 미지원 | 없음 | 잘못 매칭된 상품을 수동 제거할 방법 없음 |

**예시 시나리오**: 사업체 1개, 상품 5개, 키워드 평균 3개 = 15건
- 현재: 15건 × (API 1s + 지연 3.5s) ≈ **67초**
- 중복 제거 후 10건 × 병렬 5개 = 2배치 × (1s + 3.5s) ≈ **9초**

---

## 2. Scope

### 2.1 In Scope

- [x] FR-01: httpx 연결 풀링 (persistent client)
- [x] FR-02: 키워드 병렬 크롤링 (semaphore 제한)
- [x] FR-03: 유저 단위 키워드 중복 제거
- [x] FR-04: 크롤링 통계 API 개선
- [x] FR-05: 모델코드 + 규격 키워드 기반 관련성 필터링
- [x] FR-06: 네이버 productId 기반 블랙리스트

### 2.2 Out of Scope

- 네이버 API 외 다른 플랫폼 크롤러 추가
- 프론트엔드 크롤링 UI 변경 (Antigravity 담당)
- 프록시/IP 로테이션

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-01 | httpx.AsyncClient를 앱 수명주기에 맞게 한 번만 생성하여 연결 재사용 | High | Pending |
| FR-02 | 동일 유저의 키워드를 동시성 제한(semaphore) 하에 병렬 크롤링 | High | Pending |
| FR-03 | 유저 전체 크롤링 시 동일 키워드는 1회만 호출하고 결과를 공유 | Medium | Pending |
| FR-04 | 크롤링 소요 시간, 처리량 통계를 API로 노출 | Low | Pending |
| FR-05 | Product에 model_code + spec_keywords 추가, 검색 결과의 관련성(is_relevant) 자동 판별 | High | Pending |
| FR-06 | 네이버 productId 기반 블랙리스트로 특정 상품 영구 제외 | High | Pending |

### 3.2 Non-Functional Requirements

| Category | Criteria | Measurement Method |
|----------|----------|-------------------|
| Performance | 유저 전체 크롤링 소요 시간 50% 이상 단축 | CrawlLog duration_ms 합계 비교 |
| 안정성 | 네이버 API Rate Limit 준수 (초당 10건 이내) | semaphore + delay로 제어 |
| 호환성 | 기존 API 엔드포인트 동작 변경 없음 | 기존 API 테스트 |

---

## 4. Success Criteria

### 4.1 Definition of Done

- [x] 모든 FR 구현 완료
- [x] 서버 정상 기동 확인
- [x] 기존 크롤링 API 호환성 유지
- [x] 네이버 API Rate Limit 위반 없음

### 4.2 Quality Criteria

- [x] 빌드(서버 기동) 성공
- [x] Gap Analysis 90% 이상

---

## 5. Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| 네이버 API Rate Limit 초과 | High | Medium | semaphore로 동시 요청 수 제한 (기본 5) |
| 병렬 처리 시 DB 세션 충돌 | Medium | Low | 크롤링 결과를 모아서 순차적으로 DB 기록 |
| httpx 클라이언트 메모리 누수 | Low | Low | app lifespan에서 close 보장 |

---

## 6. Architecture Considerations

### 6.1 변경 대상 파일

| 파일 | 변경 내용 |
|------|-----------|
| `backend/app/crawlers/naver.py` | persistent AsyncClient, 연결 풀링 |
| `backend/app/crawlers/manager.py` | 병렬 크롤링, 키워드 중복 제거 |
| `backend/app/core/config.py` | CRAWL_CONCURRENCY 설정 추가 |
| `backend/app/main.py` | httpx client lifespan 관리 |
| `backend/app/api/crawl.py` | 통계 API 개선 (선택) |
| `backend/app/models/product.py` | model_code, spec_keywords 컬럼 추가 |
| `backend/app/models/keyword_ranking.py` | naver_product_id, is_relevant 컬럼 추가 |
| `backend/app/models/excluded_product.py` | 블랙리스트 모델 (신규) |
| `backend/app/schemas/product.py` | model_code, spec_keywords 필드 추가 |
| `backend/app/api/products.py` | 블랙리스트 API 엔드포인트 추가 |
| `backend/app/services/product_service.py` | is_relevant 기준으로 최저가/순위 계산 |

### 6.2 Key Decisions

| Decision | Options | Selected | Rationale |
|----------|---------|----------|-----------|
| 동시성 제어 | asyncio.Semaphore / aiolimiter | Semaphore | 외부 의존성 없음, 충분한 기능 |
| 클라이언트 수명 | Per-request / App-level | App-level | 연결 재사용으로 성능 향상 |
| 중복 제거 방식 | 캐시 dict / Redis | 메모리 dict | 개인용 도구, 키워드 수 적음 |

---

## 7. Implementation Sketch

### FR-01: httpx 연결 풀링
```python
# naver.py - 클래스 레벨 client
class NaverCrawler(BaseCrawler):
    def __init__(self):
        self._client = httpx.AsyncClient(timeout=10, limits=httpx.Limits(...))

    async def close(self):
        await self._client.aclose()

# main.py - lifespan에서 관리
```

### FR-02: 병렬 크롤링
```python
# manager.py
semaphore = asyncio.Semaphore(settings.CRAWL_CONCURRENCY)

async def _crawl_with_limit(sem, keyword, ...):
    async with sem:
        await asyncio.sleep(random.uniform(delay_min, delay_max))
        return await crawler.search_keyword(keyword)

# asyncio.gather(*tasks)로 병렬 실행
```

### FR-03: 키워드 중복 제거
```python
# crawl_user_all에서 전체 키워드 수집 → 유니크 키워드만 크롤링 → 결과 매핑
unique_keywords = {kw.keyword: kw for kw in all_keywords}
# 크롤링 결과를 keyword string 기준으로 각 product의 keyword에 분배
```

---

## 8. Next Steps

1. [x] Plan 문서 작성 완료
2. [ ] Design 문서 작성 (`/pdca design crawl-performance`)
3. [ ] 구현 시작
4. [ ] Gap Analysis

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-02-21 | Initial draft (FR-01~04) | Claude Code |
| 0.2 | 2026-02-21 | FR-05 모델코드 매칭, FR-06 블랙리스트 추가 | Claude Code |
