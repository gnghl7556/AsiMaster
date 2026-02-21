# Design: 키워드별 정렬 유형 (노출 순위 / 가격 순위)

> Plan 문서: `docs/01-plan/features/keyword-sort-type.plan.md`

## 요구사항 정리

| ID | 요구사항 | 우선순위 |
|----|----------|----------|
| FR-01 | SearchKeyword 모델에 sort_type 필드 추가 | 필수 |
| FR-02 | 크롤러 체인에 sort_type 파라미터 전달 | 필수 |
| FR-03 | 키워드 API에서 sort_type 수신/반환 | 필수 |
| FR-04 | 상품 상세 API 응답에 sort_type 포함 | 필수 |
| FR-05 | CLAUDE.md API 명세 업데이트 | 필수 |

## 상세 설계

### FR-01: SearchKeyword 모델 변경

**파일**: `backend/app/models/search_keyword.py`

```python
# 추가할 필드
sort_type: Mapped[str] = mapped_column(String(10), default="sim")
```

- DB 컬럼은 `main.py` ALTER TABLE에 이미 존재 (`VARCHAR(10)`, 기본값 `'sim'`)
- 모델 클래스에 필드만 추가하면 즉시 동작

**허용 값**: `"sim"` (노출 순위), `"asc"` (가격 순위)

---

### FR-02: 크롤러 체인 sort_type 전달

#### FR-02-1: BaseCrawler 시그니처 변경

**파일**: `backend/app/crawlers/base.py`

```python
# 변경 전
@abstractmethod
async def search_keyword(self, keyword: str) -> KeywordCrawlResult:
    pass

# 변경 후
@abstractmethod
async def search_keyword(self, keyword: str, sort_type: str = "sim") -> KeywordCrawlResult:
    pass
```

#### FR-02-2: NaverCrawler 동적 sort 처리

**파일**: `backend/app/crawlers/naver.py`

```python
# 변경 전
async def search_keyword(self, keyword: str) -> KeywordCrawlResult:
    ...
    params={"query": keyword, "display": self.MAX_RESULTS, "sort": "sim"}

# 변경 후
async def search_keyword(self, keyword: str, sort_type: str = "sim") -> KeywordCrawlResult:
    ...
    params={"query": keyword, "display": self.MAX_RESULTS, "sort": sort_type}
```

#### FR-02-3: CrawlManager 전달 경로

**파일**: `backend/app/crawlers/manager.py`

**`_fetch_keyword` 변경**:
```python
# 변경 전
async def _fetch_keyword(self, keyword_str: str) -> KeywordCrawlResult:
    ...
    result = await crawler.search_keyword(keyword_str)

# 변경 후
async def _fetch_keyword(self, keyword_str: str, sort_type: str = "sim") -> KeywordCrawlResult:
    ...
    result = await crawler.search_keyword(keyword_str, sort_type=sort_type)
```

**`crawl_product` 변경** (단일 상품 크롤링):
```python
# _fetch_one 내부 변경
async def _fetch_one(kw: SearchKeyword):
    async with sem:
        ...
        r = await self._fetch_keyword(kw.keyword, sort_type=kw.sort_type or "sim")
        ...
```

**`crawl_user_all` 변경** (유저 전체 크롤링):

현재 키워드 중복 제거가 `keyword.strip().lower()` 기준으로 동작.
같은 키워드 문자열이지만 `sort_type`이 다른 경우를 구분해야 함.

```python
# 중복 제거 키 변경: keyword_str → (keyword_str, sort_type)
unique_map: dict[tuple[str, str], list[SearchKeyword]] = {}
for kw in all_keywords:
    key = (kw.keyword.strip().lower(), kw.sort_type or "sim")
    unique_map.setdefault(key, []).append(kw)

# 병렬 크롤링
async def _fetch_one(keyword_str: str, sort_type: str):
    async with sem:
        ...
        r = await self._fetch_keyword(keyword_str, sort_type=sort_type)
        ...
        return keyword_str, sort_type, r, ms

fetch_results = await asyncio.gather(
    *[_fetch_one(kw_str, st) for (kw_str, st) in unique_map.keys()]
)

# DB 기록
for kw_str, sort_type, crawl_result, duration_ms in fetch_results:
    for kw in unique_map[(kw_str, sort_type)]:
        ...
```

> **핵심 설계 결정**: 같은 키워드라도 sort_type이 다르면 별도 API 호출이 필요.
> 중복 제거 키를 `(keyword_str, sort_type)` 튜플로 변경하여 해결.

---

### FR-03: 키워드 API sort_type 수신/반환

#### FR-03-1: Pydantic 스키마

**파일**: `backend/app/schemas/search_keyword.py`

```python
from typing import Literal

class KeywordCreate(BaseModel):
    keyword: str = Field(..., min_length=1, max_length=200)
    sort_type: Literal["sim", "asc"] = "sim"

class KeywordResponse(BaseModel):
    id: int
    product_id: int
    keyword: str
    sort_type: str          # 추가
    is_primary: bool
    is_active: bool
    last_crawled_at: datetime | None
    crawl_status: str
    created_at: datetime
    model_config = {"from_attributes": True}
```

#### FR-03-2: 키워드 생성 API

**파일**: `backend/app/api/keywords.py`

```python
# create_keyword 함수 변경
keyword = SearchKeyword(
    product_id=product_id,
    keyword=data.keyword,
    sort_type=data.sort_type,    # 추가
    is_primary=False,
)
```

---

### FR-04: 상품 상세 API 응답에 sort_type 포함

**파일**: `backend/app/services/product_service.py`

`get_product_detail()` → `keywords_data` 딕셔너리에 `sort_type` 추가:

```python
keywords_data.append({
    "id": kw.id,
    "keyword": kw.keyword,
    "sort_type": kw.sort_type or "sim",   # 추가
    "is_primary": kw.is_primary,
    "crawl_status": kw.crawl_status,
    "last_crawled_at": kw.last_crawled_at,
    "rankings": [...],
})
```

---

### FR-05: CLAUDE.md API 명세 업데이트

**파일**: `CLAUDE.md`

키워드 관련 API 변경사항 기록:
- `POST /products/{product_id}/keywords`: `sort_type` 필드 추가 (기본값: `"sim"`, 허용값: `"sim"` | `"asc"`)
- `GET /products/{product_id}/keywords`: 응답에 `sort_type` 필드 포함
- 상품 상세 API keywords 배열에 `sort_type` 필드 포함

---

## 구현 순서

| 순서 | 파일 | 변경 내용 | 의존성 |
|------|------|----------|--------|
| 1 | `models/search_keyword.py` | sort_type 필드 추가 | 없음 |
| 2 | `schemas/search_keyword.py` | KeywordCreate, KeywordResponse 수정 | 1 |
| 3 | `crawlers/base.py` | search_keyword 시그니처 변경 | 없음 |
| 4 | `crawlers/naver.py` | sort 파라미터 동적 처리 | 3 |
| 5 | `crawlers/manager.py` | _fetch_keyword, crawl_product, crawl_user_all 수정 | 1, 4 |
| 6 | `api/keywords.py` | create_keyword에서 sort_type 저장 | 1, 2 |
| 7 | `services/product_service.py` | keywords_data에 sort_type 포함 | 1 |
| 8 | `CLAUDE.md` | API 명세 업데이트 | 전체 완료 후 |

## 영향 분석

### 영향 받는 기능
- 키워드 추가 API → sort_type 수신
- 크롤링 엔진 → sort_type별 네이버 API 호출
- 상품 상세 조회 → sort_type 표시
- 유저 전체 크롤링 → 중복 제거 키 변경

### 영향 없는 기능
- 상품 목록 API (sort_type은 상세에서만 필요)
- 블랙리스트 기능 (sort_type 무관)
- 알림 시스템 (sort_type 무관)
- 대시보드 (sort_type 무관)
- 마진 계산 (sort_type 무관)

## 프론트엔드 연동 명세 (Codex용)

### 타입 변경
```typescript
// types/index.ts
interface SearchKeyword {
  id: number;
  keyword: string;
  sort_type: "sim" | "asc";   // 추가
  is_primary: boolean;
  // ...
}
```

### API 호출 변경
```typescript
// 키워드 추가 시
POST /products/{id}/keywords
Body: { keyword: string, sort_type: "sim" | "asc" }
```

### UI 표시
- 키워드 추가 폼: 드롭다운 또는 라디오 버튼 ("노출 순위" / "가격 순위")
- 키워드별 순위 목록: 각 키워드 옆에 라벨 표시 (예: `[노출]`, `[가격]`)
