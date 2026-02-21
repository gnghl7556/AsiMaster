# Backend Backlog Gap Analysis Report

> **Analysis Type**: Gap Analysis (Check phase - Minor Backlog R1~R6, R8)
>
> **Project**: AsiMaster (경쟁사 가격 모니터링)
> **Analyst**: Gap Detector
> **Date**: 2026-02-21
> **Reference**: `docs/archive/2026-02/price-monitor/price-monitor.report.md` Section 4.1

---

## 1. Analysis Overview

### 1.1 Analysis Purpose

이전 PDCA 사이클(Match Rate 90%)에서 잔여 Minor 백로그 8건 중 백엔드 해당 항목 7건(R1~R6, R8)의 구현 완료 여부를 검증한다.

### 1.2 Analysis Scope

| 항목 | 내용 |
|------|------|
| 분석 대상 | 백엔드 잔여 백로그 7건 (R1, R2, R3, R4, R5, R6, R8) |
| 이전 보고서 | `docs/archive/2026-02/price-monitor/price-monitor.report.md` |
| 분석 기준일 | 2026-02-21 |

---

## 2. Item-by-Item Gap Analysis

### R1: 상품 정렬 로직 + 페이지네이션

**요구사항**: Products API에 page/limit 파라미터 지원, urgency/margin/rank_drop/category 서버 정렬, rank_change 필드 포함

**분석 결과**: MATCH

| 세부 항목 | 설계 | 구현 | 상태 |
|----------|------|------|:----:|
| page 파라미터 | Query(ge=1) | `backend/app/api/products.py:27` - `page: int = Query(1, ge=1)` | MATCH |
| limit 파라미터 | Query(ge=1, le=200) | `backend/app/api/products.py:28` - `limit: int = Query(50, ge=1, le=200)` | MATCH |
| sort 파라미터 | urgency/margin/rank_drop/category | `backend/app/api/products.py:26` - `sort: str = Query(None, description="urgency\|margin\|rank_drop\|category")` | MATCH |
| urgency 정렬 | status 기반 (losing -> close -> winning), 2차 price_gap, 3차 margin | `backend/app/services/product_service.py:188-193` - STATUS_ORDER + price_gap + margin_percent | MATCH |
| margin 정렬 | margin_percent 오름차순 | `backend/app/services/product_service.py:194-195` | MATCH |
| rank_drop 정렬 | rank_change 내림차순 (큰 하락 먼저) | `backend/app/services/product_service.py:196-198` | MATCH |
| category 정렬 | category 알파벳 + status 보조 | `backend/app/services/product_service.py:199-200` | MATCH |
| 페이지네이션 적용 | offset = (page-1)*limit, slice | `backend/app/services/product_service.py:202-204` | MATCH |
| rank_change 필드 | 이전 크롤링 대비 순위 변동 | `backend/app/services/product_service.py:162` - `_calc_rank_change()` | MATCH |

**참고**: 페이지네이션이 메모리 내 정렬 후 슬라이싱 방식이다. 데이터 규모가 커지면 DB 레벨 페이지네이션이 필요하나, 현재 개인용/수백 건 규모에서는 적합하다.

**판정**: MATCH (100%)

---

### R2: 상품 상세 API 데이터 보강

**요구사항**: ProductDetail에 user_id, rank_change, keyword_count, sparkline, competitors 필드 포함

**분석 결과**: MATCH

| 세부 항목 | 구현 위치 | 상태 |
|----------|----------|:----:|
| user_id | `backend/app/schemas/product.py:88` - `user_id: int` | MATCH |
| rank_change | `backend/app/schemas/product.py:102` - `rank_change: int \| None` | MATCH |
| keyword_count | `backend/app/schemas/product.py:103` - `keyword_count: int` | MATCH |
| sparkline | `backend/app/schemas/product.py:105` - `sparkline: list[int]` | MATCH |
| competitors | `backend/app/schemas/product.py:106` - `competitors: list[CompetitorSummary]` | MATCH |
| CompetitorSummary 스키마 | `backend/app/schemas/product.py:78-83` - rank, product_name, price, mall_name, is_my_store | MATCH |
| keywords (with rankings) | `backend/app/schemas/product.py:107` - `keywords: list[KeywordWithRankings]` | MATCH |
| margin | `backend/app/schemas/product.py:108` - `margin: MarginDetail \| None` | MATCH |

**서비스 로직 검증**:
- `get_product_detail()` (`backend/app/services/product_service.py:207-345`)에서 모든 필드를 계산하여 반환
- competitors: 최신 rankings를 rank순 정렬, mall_name 중복 제거 (`product_service.py:267-279`)
- sparkline: 최근 7일 일별 최저가 (`product_service.py:254-264`)
- rank_change: `_calc_rank_change()` 함수 (`product_service.py:63-83`)

**판정**: MATCH (100%)

---

### R3: 크롤링 재시도 로직

**요구사항**: CRAWL_MAX_RETRIES 활용, 재시도 루프, 랜덤 딜레이

**분석 결과**: MATCH

| 세부 항목 | 구현 위치 | 상태 |
|----------|----------|:----:|
| CRAWL_MAX_RETRIES 환경변수 | `backend/app/core/config.py:21` - `CRAWL_MAX_RETRIES: int = 3` | MATCH |
| crawl_keyword() 재시도 루프 | `backend/app/crawlers/manager.py:34` - `for attempt in range(1, max_retries + 1)` | MATCH |
| 성공 시 루프 탈출 | `backend/app/crawlers/manager.py:36` - `if result.success: break` | MATCH |
| 랜덤 딜레이 | `backend/app/crawlers/manager.py:39-41` - `random.uniform(DELAY_MIN, DELAY_MAX)` | MATCH |
| 재시도 로깅 | `backend/app/crawlers/manager.py:43-46` - `logger.warning(f"크롤링 재시도...")` | MATCH |
| asyncio.sleep | `backend/app/crawlers/manager.py:47` - `await asyncio.sleep(delay)` | MATCH |

**로직 흐름 확인**:
1. `max_retries = settings.CRAWL_MAX_RETRIES` (기본값 3)
2. `for attempt in range(1, max_retries + 1)` 루프
3. `crawler.search_keyword()` 호출
4. 성공 시 `break`
5. 실패 시 `random.uniform(DELAY_MIN, DELAY_MAX)` 대기 후 재시도
6. 마지막 시도 후에도 실패하면 result.success=False 상태로 진행

**판정**: MATCH (100%)

---

### R4: 스케줄러 유저별 주기

**요구사항**: User 모델에 crawl_interval_min 컬럼, 스케줄러에서 유저별 크롤링 주기 필터링, 10분 체크 주기

**분석 결과**: MATCH

| 세부 항목 | 구현 위치 | 상태 |
|----------|----------|:----:|
| User.crawl_interval_min 컬럼 | `backend/app/models/user.py:15` - `crawl_interval_min: Mapped[int] = mapped_column(default=60)` | MATCH |
| UserUpdate 스키마 | `backend/app/schemas/user.py:13` - `crawl_interval_min: int \| None = Field(None, ge=0, le=1440)` | MATCH |
| UserResponse 스키마 | `backend/app/schemas/user.py:20` - `crawl_interval_min: int` | MATCH |
| 10분 체크 주기 | `backend/app/scheduler/setup.py:16` - `check_interval = 10` | MATCH |
| 유저별 주기 필터링 | `backend/app/scheduler/jobs.py:36-47` | MATCH |
| crawl_interval_min <= 0 스킵 | `backend/app/scheduler/jobs.py:36-37` - `if user.crawl_interval_min <= 0: continue` | MATCH |
| 경과 시간 비교 | `backend/app/scheduler/jobs.py:40-47` - `elapsed < timedelta(minutes=user.crawl_interval_min)` | MATCH |
| main.py ALTER TABLE | `backend/app/main.py:26` - crawl_interval_min 컬럼 추가 마이그레이션 | MATCH |

**로직 흐름 확인**:
1. 스케줄러가 10분마다 `crawl_all_users()` 호출
2. 모든 User를 조회
3. 각 유저의 `crawl_interval_min` 확인 (0 이하이면 크롤링 비활성화)
4. `_get_user_last_crawled()`로 유저의 마지막 크롤링 시각 조회
5. 경과 시간이 `crawl_interval_min` 미만이면 스킵
6. 조건 충족 시 `crawl_user_all()` 실행

**판정**: MATCH (100%)

---

### R5: 크롤링 딜레이 환경변수 연동

**요구사항**: crawl_product()에서 키워드 간 딜레이에 CRAWL_REQUEST_DELAY_MIN/MAX 환경변수 사용

**분석 결과**: MATCH

| 세부 항목 | 구현 위치 | 상태 |
|----------|----------|:----:|
| CRAWL_REQUEST_DELAY_MIN 정의 | `backend/app/core/config.py:22` - `CRAWL_REQUEST_DELAY_MIN: int = 2` | MATCH |
| CRAWL_REQUEST_DELAY_MAX 정의 | `backend/app/core/config.py:23` - `CRAWL_REQUEST_DELAY_MAX: int = 5` | MATCH |
| crawl_product() 딜레이 사용 | `backend/app/crawlers/manager.py:105-108` - `random.uniform(settings.CRAWL_REQUEST_DELAY_MIN, settings.CRAWL_REQUEST_DELAY_MAX)` | MATCH |
| crawl_keyword() 재시도 딜레이 사용 | `backend/app/crawlers/manager.py:39-41` - 동일 환경변수 사용 | MATCH |

**검증**: 이전에는 하드코딩된 값(`random.uniform(2, 5)`)이었으나, 현재 `settings.CRAWL_REQUEST_DELAY_MIN`/`settings.CRAWL_REQUEST_DELAY_MAX`로 대체되어 환경변수로 조절 가능하다.

**판정**: MATCH (100%)

---

### R6: 웹 푸시 알림 뼈대

**요구사항**: PushSubscription 모델, send_push_to_user 함수, push API 엔드포인트, 알림 생성 시 푸시 연동

**분석 결과**: MATCH

| 세부 항목 | 구현 위치 | 상태 |
|----------|----------|:----:|
| PushSubscription 모델 | `backend/app/models/push_subscription.py` - id, user_id, endpoint, p256dh, auth, created_at | MATCH |
| VAPID_PUBLIC_KEY 환경변수 | `backend/app/core/config.py:16` | MATCH |
| VAPID_PRIVATE_KEY 환경변수 | `backend/app/core/config.py:17` | MATCH |
| VAPID_CLAIM_EMAIL 환경변수 | `backend/app/core/config.py:18` | MATCH |
| send_push_to_user() 함수 | `backend/app/services/push_service.py:20-56` | MATCH |
| VAPID 미설정 시 graceful skip | `backend/app/services/push_service.py:22-24` | MATCH |
| 만료 구독 자동 삭제 (404/410) | `backend/app/services/push_service.py:51-54` | MATCH |
| GET /push/vapid-public-key | `backend/app/api/push.py:28-30` | MATCH |
| POST /push/subscribe | `backend/app/api/push.py:33-58` - upsert 로직 포함 | MATCH |
| DELETE /push/subscribe | `backend/app/api/push.py:61-68` | MATCH |
| push_router 등록 | `backend/app/api/router.py:24` - `api_router.include_router(push_router)` | MATCH |
| alert_service 푸시 연동 | `backend/app/services/alert_service.py:12` - `from push_service import send_push_to_user` | MATCH |
| check_price_undercut 푸시 호출 | `backend/app/services/alert_service.py:80` | MATCH |
| check_rank_drop 푸시 호출 | `backend/app/services/alert_service.py:149` | MATCH |

**아키텍처 검증**:
- 모델: `PushSubscription` (user_id FK, endpoint unique, p256dh, auth)
- 서비스: `push_service.py` - pywebpush 라이브러리 활용, VAPID 인증
- API: 3개 엔드포인트 (public key 조회, 구독, 구독 해제)
- 연동: alert_service의 `check_price_undercut()`, `check_rank_drop()`에서 알림 생성과 동시에 푸시 전송

**판정**: MATCH (100%)

---

### R8: API 경로 정리

**요구사항**: GET/PUT/DELETE/PATCH products/{product_id}에서 user_id 제거

**분석 결과**: MATCH

| 세부 항목 | 이전 경로 | 현재 경로 | 상태 |
|----------|----------|----------|:----:|
| 상품 상세 조회 | GET /users/{user_id}/products/{product_id} | GET /products/{product_id} | MATCH |
| 상품 수정 | PUT /users/{user_id}/products/{product_id} | PUT /products/{product_id} | MATCH |
| 상품 삭제 | DELETE /users/{user_id}/products/{product_id} | DELETE /products/{product_id} | MATCH |
| 가격고정 토글 | PATCH /users/{user_id}/products/{product_id}/price-lock | PATCH /products/{product_id}/price-lock | MATCH |
| 상품 목록 (유지) | GET /users/{user_id}/products | GET /users/{user_id}/products | MATCH (의도적) |
| 상품 등록 (유지) | POST /users/{user_id}/products | POST /users/{user_id}/products | MATCH (의도적) |

**코드 검증** (`backend/app/api/products.py`):
- Line 59: `@router.get("/products/{product_id}", ...)` -- user_id 없음
- Line 67: `@router.put("/products/{product_id}", ...)` -- user_id 없음
- Line 82: `@router.delete("/products/{product_id}", ...)` -- user_id 없음
- Line 90: `@router.patch("/products/{product_id}/price-lock", ...)` -- user_id 없음
- Line 21: `@router.get("/users/{user_id}/products", ...)` -- 목록은 user_id 유지 (의도적)
- Line 37: `@router.post("/users/{user_id}/products", ...)` -- 등록은 user_id 유지 (의도적)

**CLAUDE.md 문서 일치 확인**: CLAUDE.md 67~73줄에서 API 엔드포인트가 정확히 현재 코드와 일치한다.

**판정**: MATCH (100%)

---

## 3. 추가 검증

### 3.1 CLAUDE.md API 변경 이력 일치 확인

| CLAUDE.md 엔드포인트 | 실제 코드 | 상태 |
|---------------------|----------|:----:|
| `POST /api/v1/users` | `backend/app/api/users.py` | MATCH |
| `PUT /api/v1/users/{id}` (naver_store_name, crawl_interval_min) | UserUpdate 스키마에 crawl_interval_min 포함 | MATCH |
| `GET /api/v1/users/{user_id}/products` | `products.py:21` | MATCH |
| `POST /api/v1/users/{user_id}/products` | `products.py:37` | MATCH |
| `GET /api/v1/products/{id}` | `products.py:59` | MATCH |
| `PUT /api/v1/products/{id}` | `products.py:67` | MATCH |
| `DELETE /api/v1/products/{id}` | `products.py:82` | MATCH |
| `PATCH /api/v1/products/{id}/price-lock` | `products.py:90` | MATCH |
| Push API (미기재) | `push.py` - 3개 엔드포인트 | GAP (문서 미반영) |

**GAP 발견**: CLAUDE.md에 Push API 엔드포인트 3건이 기재되어 있지 않다.
- `GET /api/v1/push/vapid-public-key`
- `POST /api/v1/push/subscribe`
- `DELETE /api/v1/push/subscribe`

### 3.2 config.py 환경변수 사용 확인

| 환경변수 | config.py 정의 | 실제 사용처 | 상태 |
|---------|---------------|-----------|:----:|
| VAPID_PUBLIC_KEY | `config.py:16` | `push.py:30`, `push_service.py:22` | MATCH |
| VAPID_PRIVATE_KEY | `config.py:17` | `push_service.py:22,47` | MATCH |
| VAPID_CLAIM_EMAIL | `config.py:18` | `push_service.py:17` | MATCH |
| CRAWL_DEFAULT_INTERVAL_MIN | `config.py:20` | 미사용 (User 모델 default=60으로 대체) | GAP (Dead config) |
| CRAWL_MAX_RETRIES | `config.py:21` | `manager.py:30` | MATCH |
| CRAWL_REQUEST_DELAY_MIN | `config.py:22` | `manager.py:40,106` | MATCH |
| CRAWL_REQUEST_DELAY_MAX | `config.py:23` | `manager.py:41,107` | MATCH |

**GAP 발견**: `CRAWL_DEFAULT_INTERVAL_MIN` 환경변수가 config.py에 정의되어 있으나 코드 어디에서도 사용되지 않는다. User 모델의 `crawl_interval_min` 컬럼 기본값이 직접 60으로 하드코딩되어 있다.

---

## 4. Overall Score

```
+----------------------------------------------------------+
|  Backend Backlog Match Rate: 100% (7/7 MATCH)            |
+----------------------------------------------------------+
|  항목                          | 판정     | 점수          |
|-------------------------------|----------|---------------|
|  R1 상품 정렬+페이지네이션       | MATCH    | 100%         |
|  R2 상품 상세 데이터 보강        | MATCH    | 100%         |
|  R3 크롤링 재시도 로직           | MATCH    | 100%         |
|  R4 스케줄러 유저별 주기         | MATCH    | 100%         |
|  R5 크롤링 딜레이 환경변수       | MATCH    | 100%         |
|  R6 웹 푸시 알림 뼈대           | MATCH    | 100%         |
|  R8 API 경로 정리              | MATCH    | 100%         |
+----------------------------------------------------------+
|  추가 검증                     | 상태                      |
|-------------------------------|--------------------------|
|  CLAUDE.md API 일치            | 93% (Push API 미기재)     |
|  config.py 환경변수 활용        | 86% (CRAWL_DEFAULT 미사용) |
+----------------------------------------------------------+
```

---

## 5. Minor Issues Found

### 5.1 CLAUDE.md Push API 미기재

| 구분 | 내용 |
|------|------|
| 유형 | Documentation Gap |
| 심각도 | Low |
| 설명 | Push API 3개 엔드포인트가 CLAUDE.md 핵심 API 엔드포인트 섹션에 누락 |
| 권장 조치 | CLAUDE.md에 Push API 엔드포인트 추가 |

### 5.2 CRAWL_DEFAULT_INTERVAL_MIN 미사용

| 구분 | 내용 |
|------|------|
| 유형 | Dead Configuration |
| 심각도 | Info |
| 설명 | `config.py`에 `CRAWL_DEFAULT_INTERVAL_MIN = 60`이 정의되어 있으나, User 모델의 `crawl_interval_min` 기본값이 직접 `default=60`으로 하드코딩됨 |
| 권장 조치 | (A) User 모델에서 `default=settings.CRAWL_DEFAULT_INTERVAL_MIN` 사용, 또는 (B) config.py에서 해당 항목 제거 |

### 5.3 페이지네이션 메모리 내 처리

| 구분 | 내용 |
|------|------|
| 유형 | Performance Note |
| 심각도 | Info |
| 설명 | 상품 목록 정렬과 페이지네이션이 전체 데이터를 메모리에 로드한 후 Python에서 처리됨. 현재 규모(수백 건)에서는 문제없으나, 확장 시 DB 레벨 페이지네이션 필요 |
| 권장 조치 | 현재 규모에서는 조치 불필요. 상품 1000건 이상 시 DB OFFSET/LIMIT 전환 검토 |

---

## 6. Recommended Actions

### 6.1 Immediate (Documentation Update)

| 우선순위 | 항목 | 대상 파일 |
|:--------:|------|----------|
| 1 | CLAUDE.md에 Push API 엔드포인트 3건 추가 | `CLAUDE.md` |

### 6.2 Optional (Code Cleanup)

| 우선순위 | 항목 | 대상 파일 |
|:--------:|------|----------|
| 2 | CRAWL_DEFAULT_INTERVAL_MIN을 User 모델 기본값에 연동하거나 config에서 제거 | `config.py` 또는 `models/user.py` |

---

## 7. Summary

7건의 백엔드 백로그 항목(R1~R6, R8) 모두 설계 의도대로 구현 완료되어 **Match Rate 100%**를 달성했다.

주요 구현 품질 확인 사항:
- **R1 (정렬/페이지네이션)**: 4가지 정렬 모드(urgency, margin, rank_drop, category)가 모두 올바른 기준으로 구현됨. 페이지네이션은 메모리 내 슬라이싱 방식으로 현재 규모에 적합.
- **R2 (상품 상세 보강)**: ProductDetail 스키마에 user_id, rank_change, keyword_count, sparkline, competitors, keywords, margin 모두 포함.
- **R3 (재시도 로직)**: 환경변수 기반 최대 재시도 횟수, 랜덤 딜레이, 성공 시 조기 탈출 로직 완비.
- **R4 (유저별 주기)**: crawl_interval_min 컬럼 + 스케줄러 10분 체크 + 유저별 경과 시간 비교 로직 완비.
- **R5 (딜레이 환경변수)**: 키워드 간 딜레이와 재시도 딜레이 모두 환경변수 참조.
- **R6 (웹 푸시)**: 모델, 서비스, API, 알림 연동까지 전체 파이프라인 구축 완료.
- **R8 (API 경로)**: 상품 상세/수정/삭제/가격고정에서 user_id 제거 완료, CLAUDE.md 문서와 일치.

잔여 사항은 문서 업데이트(Push API 미기재)와 코드 정리(미사용 환경변수) 2건이며, 모두 Low/Info 수준이다.

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-02-21 | Backend backlog R1~R6, R8 gap analysis | Gap Detector |
