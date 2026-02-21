# Gap Analysis: crawl-performance

> **Summary**: Design document vs implementation gap analysis for crawl-performance feature (FR-01 ~ FR-06)
>
> **Author**: Claude Code (gap-detector)
> **Created**: 2026-02-21
> **Status**: Approved
> **Design Document**: [crawl-performance.design.md](../02-design/features/crawl-performance.design.md)

---

## Match Rate: 100%

All 6 functional requirements (FR-01 through FR-06) are fully implemented as designed. No missing, added, or changed features were detected.

---

## Overall Scores

| Category | Score | Status |
|----------|:-----:|:------:|
| Design Match | 100% | PASS |
| Architecture Compliance | 100% | PASS |
| Convention Compliance | 100% | PASS |
| **Overall** | **100%** | **PASS** |

---

## Summary

The `crawl-performance` feature has been implemented with complete fidelity to the design document. Every file specified in the design has been modified (or created) with the exact structures, signatures, and logic described. The implementation also includes enhancements beyond the minimal design (e.g., per-product blacklist caching in `crawl_user_all()`, product cache for relevance checks) that do not deviate from the design intent.

---

## Detailed Analysis per FR

### FR-01: httpx Connection Pooling

| Design Item | Design Location | Implementation File | Status | Notes |
|-------------|----------------|---------------------|:------:|-------|
| Persistent `httpx.AsyncClient` in `__init__` | design.md:89-96 | `/Users/mac/Documents/Dev/AsiMaster/backend/app/crawlers/naver.py:20-24` | PASS | `timeout=10`, `Limits(max_connections=10, max_keepalive_connections=5)` -- exact match |
| `close()` method | design.md:98-99 | `/Users/mac/Documents/Dev/AsiMaster/backend/app/crawlers/naver.py:26-27` | PASS | Calls `self._client.aclose()` |
| `self._client.get(...)` usage | design.md:101-103 | `/Users/mac/Documents/Dev/AsiMaster/backend/app/crawlers/naver.py:34-45` | PASS | Uses persistent client, no `async with httpx.AsyncClient()` |
| Module-level `crawler = NaverCrawler()` | design.md:110 | `/Users/mac/Documents/Dev/AsiMaster/backend/app/crawlers/manager.py:23` | PASS | Exact match |
| Lifespan `crawler.close()` | design.md:118-127 | `/Users/mac/Documents/Dev/AsiMaster/backend/app/main.py:127-129` | PASS | `await crawler.close()` in lifespan shutdown |
| `CRAWL_CONCURRENCY` in config | design.md:139-142 | `/Users/mac/Documents/Dev/AsiMaster/backend/app/core/config.py:24` | PASS | `CRAWL_CONCURRENCY: int = 5` |

**FR-01 Score: 6/6 (100%)**

---

### FR-02: Semaphore-Based Parallel Keyword Crawling

| Design Item | Design Location | Implementation File | Status | Notes |
|-------------|----------------|---------------------|:------:|-------|
| `_fetch_keyword()` method (API only, no DB) | design.md:184-198 | `/Users/mac/Documents/Dev/AsiMaster/backend/app/crawlers/manager.py:42-60` | PASS | Retry logic with delay, no DB access |
| `_save_keyword_result()` method (DB only, sequential) | design.md:200-237 | `/Users/mac/Documents/Dev/AsiMaster/backend/app/crawlers/manager.py:62-112` | PASS | Sequential DB writes with flush |
| `crawl_product()` with semaphore + gather | design.md:152-171 | `/Users/mac/Documents/Dev/AsiMaster/backend/app/crawlers/manager.py:114-170` | PASS | Uses `asyncio.Semaphore(settings.CRAWL_CONCURRENCY)`, `asyncio.gather`, delay per task |
| Separation of fetch (parallel) and save (sequential) | design.md:179-182 | `/Users/mac/Documents/Dev/AsiMaster/backend/app/crawlers/manager.py:140-164` | PASS | Fetch via gather, then sequential `_save_keyword_result` loop |
| Alert check after results | design.md:169 | `/Users/mac/Documents/Dev/AsiMaster/backend/app/crawlers/manager.py:166-168` | PASS | `check_and_create_alerts` called |

**FR-02 Score: 5/5 (100%)**

---

### FR-03: User-Level Keyword Deduplication

| Design Item | Design Location | Implementation File | Status | Notes |
|-------------|----------------|---------------------|:------:|-------|
| Full active keyword collection with join | design.md:253-259 | `/Users/mac/Documents/Dev/AsiMaster/backend/app/crawlers/manager.py:180-189` | PASS | Join on Product, filter by `user_id`, `is_active` |
| `unique_map` by `keyword.strip().lower()` | design.md:265-267 | `/Users/mac/Documents/Dev/AsiMaster/backend/app/crawlers/manager.py:208-211` | PASS | Exact dedup logic |
| Parallel fetch of unique keywords only | design.md:270-286 | `/Users/mac/Documents/Dev/AsiMaster/backend/app/crawlers/manager.py:213-230` | PASS | `asyncio.gather` on `unique_map.keys()` |
| Results mapped to all SearchKeyword instances | design.md:293-302 | `/Users/mac/Documents/Dev/AsiMaster/backend/app/crawlers/manager.py:237-249` | PASS | Loop over `unique_map[kw_str]` for each result |
| Per-product alert check | design.md:305-310 | `/Users/mac/Documents/Dev/AsiMaster/backend/app/crawlers/manager.py:251-256` | PASS | Iterates `product_ids`, calls `check_and_create_alerts` |
| Return `{total, success, failed}` | design.md:312 | `/Users/mac/Documents/Dev/AsiMaster/backend/app/crawlers/manager.py:258` | PASS | Exact match |

**FR-03 Score: 6/6 (100%)**

---

### FR-04: Crawl Stats API Improvement

| Design Item | Design Location | Implementation File | Status | Notes |
|-------------|----------------|---------------------|:------:|-------|
| `func.avg(CrawlLog.duration_ms)` query | design.md:332-336 | `/Users/mac/Documents/Dev/AsiMaster/backend/app/api/crawl.py:69-73` | PASS | Filtered by `since` and `status == "success"` |
| `avg_duration_ms` in response | design.md:342 | `/Users/mac/Documents/Dev/AsiMaster/backend/app/api/crawl.py:79` | PASS | `round(avg_duration) if avg_duration else None` |
| Response shape: `{total_keywords, last_24h_success, last_24h_failed, avg_duration_ms}` | design.md:338-343 | `/Users/mac/Documents/Dev/AsiMaster/backend/app/api/crawl.py:75-80` | PASS | All four fields present |

**FR-04 Score: 3/3 (100%)**

---

### FR-05: Model Code + Spec Keywords Relevance Filtering

| Design Item | Design Location | Implementation File | Status | Notes |
|-------------|----------------|---------------------|:------:|-------|
| `model_code` column in Product | design.md:362 | `/Users/mac/Documents/Dev/AsiMaster/backend/app/models/product.py:27` | PASS | `Mapped[str \| None] = mapped_column(String(100))` |
| `spec_keywords` column in Product | design.md:363 | `/Users/mac/Documents/Dev/AsiMaster/backend/app/models/product.py:28` | PASS | `Mapped[list \| None] = mapped_column(JSON, default=list)` |
| `naver_product_id` in RankingItem | design.md:379 | `/Users/mac/Documents/Dev/AsiMaster/backend/app/crawlers/base.py:13` | PASS | `naver_product_id: str = ""` |
| `productId` capture in naver.py | design.md:389 | `/Users/mac/Documents/Dev/AsiMaster/backend/app/crawlers/naver.py:70` | PASS | `naver_product_id=str(item.get("productId", ""))` |
| `naver_product_id` in KeywordRanking model | design.md:398 | `/Users/mac/Documents/Dev/AsiMaster/backend/app/models/keyword_ranking.py:24` | PASS | `Mapped[str \| None] = mapped_column(String(50))` |
| `is_relevant` in KeywordRanking model | design.md:399 | `/Users/mac/Documents/Dev/AsiMaster/backend/app/models/keyword_ranking.py:26` | PASS | `Mapped[bool] = mapped_column(Boolean, default=True)` |
| Relevance logic in manager.py | design.md:417-429 | `/Users/mac/Documents/Dev/AsiMaster/backend/app/crawlers/manager.py:26-37` | PASS | Extracted as `_check_relevance()` function, same logic |
| `naver_product_id` + `is_relevant` saved in ranking | design.md:433-434 | `/Users/mac/Documents/Dev/AsiMaster/backend/app/crawlers/manager.py:93-103` | PASS | Both fields populated |
| `model_code` + `spec_keywords` in ProductCreate/Update schemas | design.md:442-450 | `/Users/mac/Documents/Dev/AsiMaster/backend/app/schemas/product.py:14-15,24-25` | PASS | Both present with `Field(None, max_length=100)` for model_code |
| `model_code` + `spec_keywords` in ProductResponse/Detail | design.md (implicit) | `/Users/mac/Documents/Dev/AsiMaster/backend/app/schemas/product.py:41-42,116-117` | PASS | Both in response schemas |
| `is_relevant` filtering in product_service lowest price | design.md:460-461 | `/Users/mac/Documents/Dev/AsiMaster/backend/app/services/product_service.py:120,231` | PASS | `relevant_rankings = [r for r in latest_rankings if r.is_relevant]` in both list and detail |
| `is_relevant` filtering in sparkline | design.md (implicit from FR-05) | `/Users/mac/Documents/Dev/AsiMaster/backend/app/services/product_service.py:151,266` | PASS | `r.is_relevant` condition in sparkline calculation |
| ALTER TABLE migration for model_code, spec_keywords, naver_product_id, is_relevant | design.md:543 (step 9) | `/Users/mac/Documents/Dev/AsiMaster/backend/app/main.py:28-31` | PASS | All 4 columns in `alter_statements` |

**FR-05 Score: 13/13 (100%)**

---

### FR-06: Naver productId-Based Blacklist

| Design Item | Design Location | Implementation File | Status | Notes |
|-------------|----------------|---------------------|:------:|-------|
| ExcludedProduct model with fields | design.md:474-487 | `/Users/mac/Documents/Dev/AsiMaster/backend/app/models/excluded_product.py:9-23` | PASS | All fields match: id, product_id (FK CASCADE), naver_product_id, naver_product_name, created_at |
| Unique index on (product_id, naver_product_id) | design.md:477 | `/Users/mac/Documents/Dev/AsiMaster/backend/app/models/excluded_product.py:11-13` | PASS | `Index("ix_excluded_product_naver", ..., unique=True)` |
| ExcludedProduct in `__init__.py` | design.md:545 (step 11) | `/Users/mac/Documents/Dev/AsiMaster/backend/app/models/__init__.py:4` | PASS | Import and `__all__` entry present |
| Product relationship to ExcludedProduct | design.md (implicit) | `/Users/mac/Documents/Dev/AsiMaster/backend/app/models/product.py:35` | PASS | `excluded_products` relationship with cascade |
| GET `/products/{product_id}/excluded` | design.md:495-497 | `/Users/mac/Documents/Dev/AsiMaster/backend/app/api/products.py:110-120` | PASS | Returns list, ordered by created_at desc |
| POST `/products/{product_id}/excluded` (201) | design.md:500-503 | `/Users/mac/Documents/Dev/AsiMaster/backend/app/api/products.py:123-147` | PASS | Includes duplicate check (409), status_code=201 |
| DELETE `/products/{product_id}/excluded/{naver_product_id}` (204) | design.md:506-508 | `/Users/mac/Documents/Dev/AsiMaster/backend/app/api/products.py:150-163` | PASS | status_code=204, 404 if not found |
| Blacklist schemas (ExcludeProductRequest, ExcludedProductResponse) | design.md:502 | `/Users/mac/Documents/Dev/AsiMaster/backend/app/schemas/product.py:94-105` | PASS | All fields match |
| CompetitorSummary with naver_product_id + is_relevant | design.md (implicit) | `/Users/mac/Documents/Dev/AsiMaster/backend/app/schemas/product.py:84-91` | PASS | Both fields present |
| Blacklist query in `crawl_product()` | design.md:519-524 | `/Users/mac/Documents/Dev/AsiMaster/backend/app/crawlers/manager.py:133-138` | PASS | `select(ExcludedProduct.naver_product_id).where(...)` |
| Blacklist skip in `_save_keyword_result()` | design.md:413-414 | `/Users/mac/Documents/Dev/AsiMaster/backend/app/crawlers/manager.py:83-85` | PASS | `continue` on blacklisted items |
| Per-product blacklist in `crawl_user_all()` | design.md:527 (implicit) | `/Users/mac/Documents/Dev/AsiMaster/backend/app/crawlers/manager.py:193-201` | PASS | `excluded_by_product` dict, per-product lookup |
| RankingItemResponse with naver_product_id + is_relevant | design.md (implicit) | `/Users/mac/Documents/Dev/AsiMaster/backend/app/schemas/search_keyword.py:29-33` | PASS | Both fields in response schema |

**FR-06 Score: 13/13 (100%)**

---

## Gaps Found

### Missing Features (Design O, Implementation X)

None.

### Added Features (Design X, Implementation O)

| Item | Implementation Location | Description | Impact |
|------|------------------------|-------------|--------|
| Product cache in `crawl_user_all()` | `/Users/mac/Documents/Dev/AsiMaster/backend/app/crawlers/manager.py:203-206` | `products_cache` dict for efficient Product lookups | None (Enhancement) |
| Per-product blacklist cache in `crawl_user_all()` | `/Users/mac/Documents/Dev/AsiMaster/backend/app/crawlers/manager.py:193-201` | `excluded_by_product` dict, pre-fetched per product | None (Enhancement) |
| `_check_relevance()` as standalone function | `/Users/mac/Documents/Dev/AsiMaster/backend/app/crawlers/manager.py:26-37` | Relevance logic extracted to module-level function instead of inline | None (Better separation) |
| Compatibility routes | `/Users/mac/Documents/Dev/AsiMaster/backend/app/api/products.py:166-185` | Legacy `/users/{user_id}/products/{product_id}` routes | None (Pre-existing) |

These additions are all enhancements or pre-existing code that do not conflict with the design.

### Changed Features (Design != Implementation)

None. All implementation details match the design specification.

---

## Architecture Compliance

| Check Item | Status | Notes |
|------------|:------:|-------|
| `crawlers/` separation (naver.py, manager.py, base.py) | PASS | Clean separation of concerns |
| `models/` for data models | PASS | Product, KeywordRanking, ExcludedProduct all properly defined |
| `schemas/` for Pydantic schemas | PASS | Request/Response schemas match API needs |
| `services/` for business logic | PASS | `product_service.py` handles filtering, calculations |
| `api/` for route handlers | PASS | Thin handlers delegating to services/manager |
| Dependency direction: API -> Service -> Model | PASS | No reverse dependencies detected |

---

## Convention Compliance

| Check Item | Status | Notes |
|------------|:------:|-------|
| Function naming (snake_case) | PASS | `_fetch_keyword`, `_save_keyword_result`, `_check_relevance` |
| Class naming (PascalCase) | PASS | `NaverCrawler`, `CrawlManager`, `ExcludedProduct` |
| Constant naming (UPPER_SNAKE_CASE) | PASS | `CRAWL_CONCURRENCY`, `MAX_RESULTS` |
| File naming (snake_case.py) | PASS | `excluded_product.py`, `keyword_ranking.py`, etc. |
| Import ordering | PASS | stdlib -> third-party -> local imports |

---

## Recommendations

No immediate actions required. The implementation is fully aligned with the design document.

### Optional Improvements (not gaps)

1. **Design Document Update**: The design document could be updated to reflect the `products_cache` and `excluded_by_product` optimizations in `crawl_user_all()`, and the extraction of `_check_relevance()` as a module-level function. These are implementation-level improvements that enhance the design.

2. **Test Plan Completion**: The design document marks all test items as checked. Verify these tests have been manually executed or automated.

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-02-21 | Initial gap analysis | Claude Code (gap-detector) |

---

## Related Documents

- Design: [crawl-performance.design.md](../02-design/features/crawl-performance.design.md)
