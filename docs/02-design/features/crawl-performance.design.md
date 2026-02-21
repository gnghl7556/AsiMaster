# 크롤링 성능 개선 Design Document

> **Summary**: 크롤링 성능(병렬화, 연결 풀링)과 정확도(모델코드 매칭, 블랙리스트)를 함께 개선
>
> **Project**: AsiMaster
> **Author**: Claude Code
> **Date**: 2026-02-21
> **Status**: Draft
> **Planning Doc**: [crawl-performance.plan.md](../01-plan/features/crawl-performance.plan.md)

---

## 1. Overview

### 1.1 Design Goals

- 크롤링 전체 소요 시간을 50% 이상 단축
- 네이버 API Rate Limit을 안전하게 준수
- 기존 API 엔드포인트 동작을 변경하지 않음
- 검색 결과 중 관련 없는 상품을 자동/수동으로 필터링하여 정확한 가격 비교 제공
- 코드 변경을 최소화하여 안정성 유지

### 1.2 Design Principles

- **최소 변경**: 기존 구조를 최대한 유지하되 성능 병목만 해소
- **안전한 동시성**: semaphore로 동시 요청 수를 명시적으로 제한
- **리소스 관리**: httpx 클라이언트를 앱 수명주기에 맞춰 관리
- **정확한 경쟁사 식별**: 모델코드 + 규격으로 자동 판별, 블랙리스트로 수동 보정

---

## 2. Architecture

### 2.1 현재 흐름 (Before)

```
crawl_all_users()
  └─ for user in users:           (순차)
       └─ crawl_user_all(user_id)
            └─ for product in products:     (순차)
                 └─ crawl_product(product_id)
                      └─ for keyword in keywords:   (순차, 키워드 간 delay)
                           └─ crawl_keyword(keyword)
                                └─ httpx.AsyncClient()  ← 매번 새 연결
                                     └─ GET naver API
```

### 2.2 개선 흐름 (After)

```
crawl_all_users()
  └─ for user in users:           (순차 - DB 세션 안전)
       └─ crawl_user_all(user_id)
            ├─ 1. 전체 키워드 수집 + 중복 제거  ← FR-03
            ├─ 2. semaphore 병렬 크롤링          ← FR-02
            │    └─ asyncio.gather(tasks)
            │         └─ sem.acquire → delay → search_keyword()
            │              └─ self._client  ← FR-01 (persistent)
            └─ 3. 결과를 각 키워드에 매핑 + DB 기록
```

### 2.3 Dependencies

| Component | Depends On | Purpose |
|-----------|-----------|---------|
| `NaverCrawler` | `httpx.AsyncClient` | 네이버 API 호출, 연결 풀링 |
| `CrawlManager` | `NaverCrawler`, `asyncio.Semaphore` | 병렬 크롤링 조율 |
| `main.py lifespan` | `NaverCrawler.close()` | 클라이언트 정리 |
| `config.py` | - | `CRAWL_CONCURRENCY` 설정 |

---

## 3. Detailed Design

### 3.1 FR-01: httpx 연결 풀링

**파일**: `backend/app/crawlers/naver.py`

**변경 내용**:
- `search_keyword()` 내부의 `async with httpx.AsyncClient()` 제거
- 클래스 `__init__`에서 persistent `httpx.AsyncClient` 생성
- `close()` 메서드 추가

```python
class NaverCrawler(BaseCrawler):
    platform_name = "naver"
    MAX_RESULTS = 10

    def __init__(self):
        self._client = httpx.AsyncClient(
            timeout=10,
            limits=httpx.Limits(
                max_connections=10,
                max_keepalive_connections=5,
            ),
        )

    async def close(self):
        await self._client.aclose()

    async def search_keyword(self, keyword: str) -> KeywordCrawlResult:
        # self._client 사용 (기존 async with 블록 제거)
        resp = await self._client.get(...)
        ...
```

**파일**: `backend/app/crawlers/manager.py`

**변경 내용**:
- 모듈 레벨 `crawler = NaverCrawler()` 유지 (기존과 동일)

**파일**: `backend/app/main.py`

**변경 내용**:
- lifespan shutdown에서 `crawler.close()` 호출

```python
from app.crawlers.manager import crawler  # 모듈 레벨 인스턴스

@asynccontextmanager
async def lifespan(app: FastAPI):
    # ... 기존 startup 로직 ...
    init_scheduler()
    yield
    shutdown_scheduler()
    await crawler.close()  # 추가
```

---

### 3.2 FR-02: 키워드 병렬 크롤링

**파일**: `backend/app/core/config.py`

**변경 내용**:
- `CRAWL_CONCURRENCY: int = 5` 추가

```python
class Settings(BaseSettings):
    ...
    CRAWL_CONCURRENCY: int = 5  # 동시 크롤링 최대 수
    ...
```

**파일**: `backend/app/crawlers/manager.py`

**변경 내용**:

`crawl_product()` 메서드를 병렬화:

```python
async def crawl_product(self, db: AsyncSession, product_id: int) -> list[KeywordCrawlResult]:
    # ... product/user 조회 동일 ...

    sem = asyncio.Semaphore(settings.CRAWL_CONCURRENCY)

    async def _crawl_one(kw: SearchKeyword) -> KeywordCrawlResult:
        async with sem:
            delay = random.uniform(
                settings.CRAWL_REQUEST_DELAY_MIN,
                settings.CRAWL_REQUEST_DELAY_MAX,
            )
            await asyncio.sleep(delay)
            return await self.crawl_keyword(db, kw, naver_store_name)

    results = await asyncio.gather(*[_crawl_one(kw) for kw in keywords])

    if results:
        await check_and_create_alerts(db, product, keywords, naver_store_name)
    return list(results)
```

**주의사항**:
- `asyncio.gather`로 병렬 실행하되, semaphore로 동시 요청 수 제한
- 각 태스크 내에서 delay를 유지하여 Rate Limit 준수
- DB 세션(`db`)은 SQLAlchemy async 세션이므로 동일 세션에서 concurrent write 시 flush 충돌 가능 → `crawl_keyword()` 내부의 `db.flush()`를 gather 후 한 번에 처리하도록 분리

**DB 세션 안전성 해결**:
- `crawl_keyword()`를 두 단계로 분리:
  1. `_fetch_keyword()`: API 호출만 수행 (DB 접근 없음, 병렬 안전)
  2. `_save_keyword_result()`: DB 기록 (순차 처리)

```python
async def _fetch_keyword(self, keyword_str: str) -> KeywordCrawlResult:
    """네이버 API 호출만 수행 (DB 접근 없음)"""
    max_retries = settings.CRAWL_MAX_RETRIES
    result = None
    for attempt in range(1, max_retries + 1):
        result = await crawler.search_keyword(keyword_str)
        if result.success:
            break
        if attempt < max_retries:
            delay = random.uniform(
                settings.CRAWL_REQUEST_DELAY_MIN,
                settings.CRAWL_REQUEST_DELAY_MAX,
            )
            await asyncio.sleep(delay)
    return result

async def _save_keyword_result(
    self, db: AsyncSession, keyword: SearchKeyword,
    result: KeywordCrawlResult, naver_store_name: str | None,
    duration_ms: int,
) -> None:
    """크롤링 결과를 DB에 저장 (순차 호출)"""
    log = CrawlLog(
        keyword_id=keyword.id,
        status="success" if result.success else "failed",
        error_message=result.error,
        duration_ms=duration_ms,
    )
    db.add(log)

    if result.success and result.items:
        for item in result.items:
            is_my = (
                bool(naver_store_name)
                and item.mall_name.strip().lower() == naver_store_name.strip().lower()
            )
            ranking = KeywordRanking(
                keyword_id=keyword.id,
                rank=item.rank,
                product_name=item.product_name,
                price=item.price,
                mall_name=item.mall_name,
                product_url=item.product_url,
                image_url=item.image_url,
                is_my_store=is_my,
            )
            db.add(ranking)
        keyword.last_crawled_at = datetime.utcnow()
        keyword.crawl_status = "success"
    else:
        keyword.crawl_status = "failed"

    await db.flush()
```

---

### 3.3 FR-03: 유저 단위 키워드 중복 제거

**파일**: `backend/app/crawlers/manager.py`

**변경 내용**: `crawl_user_all()` 메서드 개선

```python
async def crawl_user_all(self, db: AsyncSession, user_id: int) -> dict:
    user = await db.get(User, user_id)
    naver_store_name = user.naver_store_name if user else None

    # 1. 전체 활성 키워드 수집
    result = await db.execute(
        select(SearchKeyword)
        .join(Product, SearchKeyword.product_id == Product.id)
        .where(Product.user_id == user_id, Product.is_active == True,
               SearchKeyword.is_active == True)
    )
    all_keywords = result.scalars().all()

    if not all_keywords:
        return {"total": 0, "success": 0, "failed": 0}

    # 2. 키워드 문자열 기준 중복 제거
    unique_map: dict[str, list[SearchKeyword]] = {}
    for kw in all_keywords:
        unique_map.setdefault(kw.keyword.strip().lower(), []).append(kw)

    # 3. 유니크 키워드만 병렬 크롤링
    sem = asyncio.Semaphore(settings.CRAWL_CONCURRENCY)

    async def _fetch_one(keyword_str: str) -> tuple[str, KeywordCrawlResult, int]:
        async with sem:
            delay = random.uniform(
                settings.CRAWL_REQUEST_DELAY_MIN,
                settings.CRAWL_REQUEST_DELAY_MAX,
            )
            await asyncio.sleep(delay)
            start = time.time()
            result = await self._fetch_keyword(keyword_str)
            duration_ms = int((time.time() - start) * 1000)
            return keyword_str, result, duration_ms

    fetch_results = await asyncio.gather(
        *[_fetch_one(kw_str) for kw_str in unique_map.keys()]
    )

    # 4. 결과를 각 SearchKeyword에 순차적으로 DB 기록
    total = 0
    success = 0
    failed = 0

    for kw_str, crawl_result, duration_ms in fetch_results:
        for kw in unique_map[kw_str]:
            await self._save_keyword_result(
                db, kw, crawl_result, naver_store_name, duration_ms
            )
            total += 1
            if crawl_result.success:
                success += 1
            else:
                failed += 1

    # 5. 알림 체크 (상품별)
    product_ids = {kw.product_id for kw in all_keywords}
    for pid in product_ids:
        product = await db.get(Product, pid)
        product_keywords = [kw for kw in all_keywords if kw.product_id == pid]
        if product and product_keywords:
            await check_and_create_alerts(db, product, product_keywords, naver_store_name)

    return {"total": total, "success": success, "failed": failed}
```

**기존 `crawl_product()` 유지**: 단일 상품 수동 크롤링용 (API에서 호출)
- 이 메서드는 중복 제거 없이 해당 상품의 키워드만 병렬 크롤링

---

### 3.4 FR-04: 크롤링 통계 API 개선

**파일**: `backend/app/api/crawl.py`

**변경 내용**: `get_crawl_status()` 응답에 평균 소요 시간 추가

```python
@router.get("/status/{user_id}")
async def get_crawl_status(user_id: int, db: AsyncSession = Depends(get_db)):
    # ... 기존 total_keywords, status_counts 동일 ...

    # 평균 소요 시간 추가
    avg_q = await db.execute(
        select(func.avg(CrawlLog.duration_ms))
        .where(CrawlLog.created_at >= since, CrawlLog.status == "success")
    )
    avg_duration = avg_q.scalar_one_or_none()

    return {
        "total_keywords": total,
        "last_24h_success": status_counts.get("success", 0),
        "last_24h_failed": status_counts.get("failed", 0),
        "avg_duration_ms": round(avg_duration) if avg_duration else None,
    }
```

---

### 3.5 FR-05: 모델코드 + 규격 키워드 기반 관련성 필터링

**핵심 개념**:
- 상품에 `model_code`(예: "4533961")와 `spec_keywords`(예: ["270m", "16롤"])를 등록
- 크롤링 결과의 상품명에 model_code와 모든 spec_keywords가 포함되면 `is_relevant=true`
- 최저가, 순위, 상태 계산 시 `is_relevant=true`인 결과만 사용

**파일**: `backend/app/models/product.py`

```python
from sqlalchemy import JSON

class Product(Base):
    ...
    model_code: Mapped[str | None] = mapped_column(String(100))
    spec_keywords: Mapped[list | None] = mapped_column(JSON, default=list)
```

**파일**: `backend/app/crawlers/base.py`

RankingItem에 `naver_product_id` 추가:

```python
@dataclass
class RankingItem:
    rank: int
    product_name: str
    price: int
    mall_name: str = ""
    product_url: str = ""
    image_url: str = ""
    naver_product_id: str = ""  # 추가: 블랙리스트용
```

**파일**: `backend/app/crawlers/naver.py`

검색 결과에서 `productId` 수집:

```python
items.append(RankingItem(
    ...
    naver_product_id=str(item.get("productId", "")),  # 추가
))
```

**파일**: `backend/app/models/keyword_ranking.py`

```python
class KeywordRanking(Base):
    ...
    naver_product_id: Mapped[str | None] = mapped_column(String(50))  # 추가
    is_relevant: Mapped[bool] = mapped_column(Boolean, default=True)  # 추가
```

**파일**: `backend/app/crawlers/manager.py`

`_save_keyword_result()`에서 관련성 판별 로직 추가:

```python
async def _save_keyword_result(self, db, keyword, result, naver_store_name,
                                duration_ms, product=None, excluded_ids=None):
    ...
    if result.success and result.items:
        for item in result.items:
            # 블랙리스트 체크 (FR-06)
            if excluded_ids and item.naver_product_id in excluded_ids:
                continue  # 블랙리스트 상품은 저장하지 않음

            # 관련성 판별 (FR-05)
            is_relevant = True
            if product and product.model_code:
                title_lower = item.product_name.lower()
                # 모델코드 포함 여부
                if product.model_code.lower() not in title_lower:
                    is_relevant = False
                # 규격 키워드 전부 포함 여부
                if is_relevant and product.spec_keywords:
                    for spec in product.spec_keywords:
                        if spec.lower() not in title_lower:
                            is_relevant = False
                            break

            ranking = KeywordRanking(
                keyword_id=keyword.id,
                ...
                naver_product_id=item.naver_product_id,
                is_relevant=is_relevant,
            )
            db.add(ranking)
```

**파일**: `backend/app/schemas/product.py`

```python
class ProductCreate(BaseModel):
    ...
    model_code: str | None = None
    spec_keywords: list[str] | None = None

class ProductUpdate(BaseModel):
    ...
    model_code: str | None = None
    spec_keywords: list[str] | None = None
```

**파일**: `backend/app/services/product_service.py`

최저가/순위 계산 시 `is_relevant=True` 조건 추가:

```python
# 기존: 모든 랭킹에서 최저가
# 변경: is_relevant=True인 랭킹에서만 최저가
rankings = [r for r in latest_rankings if r.is_relevant]
```

---

### 3.6 FR-06: 네이버 productId 기반 블랙리스트

**핵심 개념**:
- 사용자가 "이 상품은 내 상품과 관련 없다"고 판단한 경우 해당 네이버 productId를 블랙리스트에 등록
- 이후 크롤링 시 해당 productId는 결과에서 자동 제외

**파일**: `backend/app/models/excluded_product.py` (신규)

```python
class ExcludedProduct(Base):
    __tablename__ = "excluded_products"
    __table_args__ = (
        Index("ix_excluded_product_naver", "product_id", "naver_product_id", unique=True),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="CASCADE"), nullable=False
    )
    naver_product_id: Mapped[str] = mapped_column(String(50), nullable=False)
    naver_product_name: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
```

**파일**: `backend/app/api/products.py`

블랙리스트 API 엔드포인트 3개 추가:

```python
# 블랙리스트 조회
@router.get("/products/{product_id}/excluded")
async def get_excluded_products(product_id: int, db):
    ...

# 블랙리스트 추가
@router.post("/products/{product_id}/excluded", status_code=201)
async def exclude_product(product_id: int, data: ExcludeProductRequest, db):
    # data: { naver_product_id: str, naver_product_name: str | None }
    ...

# 블랙리스트 해제
@router.delete("/products/{product_id}/excluded/{naver_product_id}", status_code=204)
async def unexclude_product(product_id: int, naver_product_id: str, db):
    ...
```

**파일**: `backend/app/crawlers/manager.py`

크롤링 전 블랙리스트 조회:

```python
async def crawl_product(self, db, product_id):
    product = await db.get(Product, product_id)
    ...
    # 블랙리스트 조회
    excluded_result = await db.execute(
        select(ExcludedProduct.naver_product_id)
        .where(ExcludedProduct.product_id == product_id)
    )
    excluded_ids = set(excluded_result.scalars().all())

    # _save_keyword_result에 excluded_ids 전달
```

---

## 4. Implementation Order

| 순서 | 항목 | 파일 | 설명 |
|:----:|------|------|------|
| 1 | FR-01 | `config.py` | `CRAWL_CONCURRENCY` 설정 추가 |
| 2 | FR-01 | `naver.py` | persistent client + `close()` 메서드 |
| 3 | FR-01 | `main.py` | lifespan에서 `crawler.close()` 호출 |
| 4 | FR-05 | `base.py` | RankingItem에 `naver_product_id` 추가 |
| 5 | FR-05 | `naver.py` | API 응답에서 productId 수집 |
| 6 | FR-05 | `product.py (model)` | `model_code`, `spec_keywords` 컬럼 추가 |
| 7 | FR-05 | `keyword_ranking.py` | `naver_product_id`, `is_relevant` 컬럼 추가 |
| 8 | FR-05 | `product.py (schema)` | Create/Update에 model_code, spec_keywords 추가 |
| 9 | FR-05 | `main.py` | ALTER TABLE 마이그레이션 |
| 10 | FR-06 | `excluded_product.py` | ExcludedProduct 모델 신규 생성 |
| 11 | FR-06 | `models/__init__.py` | ExcludedProduct import 등록 |
| 12 | FR-06 | `products.py (api)` | 블랙리스트 API 3개 추가 |
| 13 | FR-02 | `manager.py` | `_fetch_keyword()`, `_save_keyword_result()` 분리 + 관련성 판별 + 블랙리스트 적용 |
| 14 | FR-02 | `manager.py` | `crawl_product()` 병렬화 |
| 15 | FR-03 | `manager.py` | `crawl_user_all()` 중복 제거 + 병렬화 |
| 16 | FR-05 | `product_service.py` | is_relevant 기준으로 최저가/순위 계산 |
| 17 | FR-04 | `crawl.py` | 통계 API에 avg_duration_ms 추가 |
| 18 | 검증 | - | 서버 기동 + API 테스트 |

---

## 5. Error Handling

| 상황 | 처리 방식 |
|------|-----------|
| httpx 클라이언트 연결 실패 | 기존 재시도 로직 유지 (FR-01과 독립) |
| semaphore deadlock | timeout 없이 asyncio.Semaphore 사용 (deadlock 불가) |
| gather 내 일부 태스크 실패 | `return_exceptions=False` (기본값) → 첫 예외 전파 → try/except로 개별 처리 |
| DB flush 충돌 | API 호출과 DB 기록을 분리하여 순차 flush (FR-02 설계로 해결) |

---

## 6. Risk Mitigation

| Risk | Mitigation |
|------|------------|
| 네이버 Rate Limit | `CRAWL_CONCURRENCY=5` + 키워드 간 2~5초 delay |
| httpx 클라이언트 누수 | lifespan shutdown에서 `close()` 보장 |
| 메모리 사용량 증가 | 개인용 도구이므로 키워드 수 제한적, 문제 없음 |

---

## 7. Test Plan

- [x] 서버 정상 기동 확인
- [x] `POST /crawl/product/{id}` 정상 동작 (단일 상품 크롤링)
- [x] `POST /crawl/user/{id}` 정상 동작 (유저 전체 크롤링)
- [x] `GET /crawl/status/{id}` 응답에 `avg_duration_ms` 포함
- [x] 중복 키워드 있을 때 API 호출 수가 유니크 키워드 수와 일치하는지 로그 확인
- [x] model_code 설정 시 is_relevant 필터링 정상 동작
- [x] 블랙리스트 API (추가/조회/삭제) 정상 동작
- [x] 블랙리스트 상품이 크롤링 결과에서 제외되는지 확인
- [x] 최저가/순위 계산이 is_relevant=true 기준으로 동작하는지 확인

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-02-21 | Initial draft (FR-01~04) | Claude Code |
| 0.2 | 2026-02-21 | FR-05 모델코드 매칭, FR-06 블랙리스트 추가 | Claude Code |
