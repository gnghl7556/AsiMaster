# Backend Improvements (Phase 2-6) Analysis Report

> **Analysis Type**: Gap Analysis (Plan vs Implementation)
>
> **Project**: AsiMaster
> **Analyst**: gap-detector
> **Date**: 2026-02-23
> **Plan**: 8 Batches, 10 files, ~30 discrete items

---

## 1. Analysis Overview

### 1.1 Analysis Purpose

Verify that the 8-batch backend improvement plan has been fully and correctly implemented in the actual codebase. Each planned item is compared against the corresponding source file.

### 1.2 Analysis Scope

- **Plan**: 8 batches covering scheduler safety, crawl error isolation, concurrency locks, N+1 query optimization, data retention, httpx client sharing, health checks, and code deduplication
- **Implementation Path**: `backend/app/`
- **Files Analyzed**: 10 files across `scheduler/`, `core/`, `crawlers/`, `api/`, `services/`, `models/`, `main.py`

---

## 2. Batch-by-Batch Verification

### Batch 1: Quick Wins

| # | Item | File | Status | Evidence |
|---|------|------|:------:|----------|
| 2-1a | `max_instances=1` on crawl `add_job()` | `scheduler/setup.py:24` | PASS | `max_instances=1` present on `crawl_scheduled` job |
| 3-4 | `pool_size=10, max_overflow=20, pool_pre_ping=True` on engine | `core/database.py:14-16` | PASS | All three params present on `create_async_engine` |

**Batch 1 Score: 2/2 (100%)**

---

### Batch 2: Crawling Error Isolation

| # | Item | File | Status | Evidence |
|---|------|------|:------:|----------|
| 2-4a | `_save_keyword_result()` in `crawl_product` wrapped in try-except | `crawlers/manager.py:222-230` | PASS | `try/except Exception as e` with `logger.error` |
| 2-4b | `_save_keyword_result()` in `crawl_user_all` wrapped in try-except | `crawlers/manager.py:330-338` | PASS | `try/except Exception as e` with `logger.error` |
| 2-3a | User list query in separate session | `scheduler/jobs.py:32-38` | PASS | `async with async_session() as db:` for user list, with its own try-except |
| 2-3b | Per-user crawling in independent sessions | `scheduler/jobs.py:47-68` | PASS | Each user gets `async with async_session() as db:` inside loop |
| 2-3c | `datetime` import added | `scheduler/jobs.py:2` | PASS | `from datetime import datetime, timedelta` present |

**Batch 2 Score: 5/5 (100%)**

---

### Batch 3: asyncio.Lock Concurrency Prevention

| # | Item | File | Status | Evidence |
|---|------|------|:------:|----------|
| 2-1a | `CrawlAlreadyRunningError` exception class | `crawlers/manager.py:25-27` | PASS | Class defined |
| 2-1b | `__init__` with `_user_locks` / `_product_locks` | `crawlers/manager.py:46-48` | PASS | Both dicts initialized in `__init__` |
| 2-1c | `is_user_crawling()` method | `crawlers/manager.py:60-62` | PASS | Returns `lock.locked()` |
| 2-1d | `is_product_crawling()` method | `crawlers/manager.py:64-66` | PASS | Returns `lock.locked()` |
| 2-1e | `crawl_product` checks lock before execution | `crawlers/manager.py:160-164` | PASS | `if lock.locked(): raise CrawlAlreadyRunningError`, then `async with lock:` |
| 2-1f | `crawl_user_all` checks lock before execution | `crawlers/manager.py:241-245` | PASS | Same pattern |
| 2-1g | `shared_manager` module-level singleton | `crawlers/manager.py:355` | PASS | `shared_manager = CrawlManager()` |
| 3a | `crawl.py` imports `shared_manager` instead of `CrawlManager()` | `api/crawl.py:9` | PASS | `from app.crawlers.manager import shared_manager as manager, CrawlAlreadyRunningError` |
| 3b | `crawl.py` catches `CrawlAlreadyRunningError` -> 409 | `api/crawl.py:26-27,44-45` | PASS | Both `crawl_product` and `crawl_user` endpoints have 409 handling |
| 3c | `jobs.py` imports `shared_manager` instead of `CrawlManager()` | `scheduler/jobs.py:9` | PASS | `from app.crawlers.manager import shared_manager` |

**Batch 3 Score: 10/10 (100%)**

---

### Batch 4: N+1 Query Optimization

| # | Item | File | Status | Evidence |
|---|------|------|:------:|----------|
| 3-3a.1 | `crawl_user_all`: batch ExcludedProduct query with `.in_(product_ids)` | `crawlers/manager.py:271-277` | PASS | `ExcludedProduct.product_id.in_(product_ids)` single query |
| 3-3a.2 | `crawl_user_all`: batch Product query with `.in_(product_ids)` | `crawlers/manager.py:280-283` | PASS | `Product.id.in_(product_ids)` single query with `products_cache` dict |
| 3-3b.1 | `alert_service.check_price_undercut()`: batch `KeywordRanking.keyword_id.in_(keyword_ids)` + Python grouping | `services/alert_service.py:48-77` | PASS | Single query with `.in_(keyword_ids)`, then `defaultdict` grouping by keyword |
| 3-3b.2 | `alert_service.check_rank_drop()`: batch query for `is_my_store=True` + Python grouping | `services/alert_service.py:122-137` | PASS | Single query with `.in_(keyword_ids)` and `is_my_store == True`, then `defaultdict` grouping |

**Batch 4 Score: 4/4 (100%)**

---

### Batch 5: Data Retention + Indexes

| # | Item | File | Status | Evidence |
|---|------|------|:------:|----------|
| 3-5a | `cleanup_old_rankings()` function exists | `scheduler/jobs.py:71-118` | PASS | Full implementation present |
| 3-5b | 30-day cutoff | `scheduler/jobs.py:73` | PASS | `utcnow() - timedelta(days=30)` |
| 3-5c | Batch delete 10k rows | `scheduler/jobs.py:74` | PASS | `batch_size = 10000` |
| 3-5d | Deletes both keyword_rankings and crawl_logs | `scheduler/jobs.py:77-109` | PASS | Two separate while-loops for each table |
| 3-5e | 24-hour cleanup job in setup.py with `max_instances=1` | `scheduler/setup.py:27-34` | PASS | `IntervalTrigger(hours=24)`, `max_instances=1` |
| 3-5f | Index `ix_keyword_rankings_naver_product_id` in model | `models/keyword_ranking.py:14` | PASS | `Index("ix_keyword_rankings_naver_product_id", "naver_product_id")` |
| 3-5g | Index `ix_keyword_rankings_crawled_at` in model | `models/keyword_ranking.py:15` | PASS | `Index("ix_keyword_rankings_crawled_at", "crawled_at")` |
| 3-5h | `CREATE INDEX IF NOT EXISTS` statements in `main.py` | `main.py:61-69` | PASS | Both index creation statements present in `apply_schema_changes()` |

**Batch 5 Score: 8/8 (100%)**

---

### Batch 6: httpx Client Consistency

| # | Item | File | Status | Evidence |
|---|------|------|:------:|----------|
| 6a | Module-level `_client` in store_scraper | `crawlers/store_scraper.py:12` | PASS | `_client: httpx.AsyncClient | None = None` |
| 6b | `_get_client()` function | `crawlers/store_scraper.py:15-19` | PASS | Creates/reuses singleton client |
| 6c | `close_client()` function | `crawlers/store_scraper.py:22-26` | PASS | Properly closes and nullifies |
| 6d | `_get_store_info()` uses shared client | `crawlers/store_scraper.py:160` | PASS | `client = _get_client()` |
| 6e | `fetch_store_products()` uses shared client | `crawlers/store_scraper.py:261` | PASS | `client = _get_client()` |
| 6f | Lifespan shutdown calls `close_client()` | `main.py:179-180` | PASS | `from app.crawlers.store_scraper import close_client as close_scraper_client; await close_scraper_client()` |

**Batch 6 Score: 6/6 (100%)**

---

### Batch 7: Health Check Improvement

| # | Item | File | Status | Evidence |
|---|------|------|:------:|----------|
| 7a | `/health` endpoint exists | `main.py:199` | PASS | `@app.get("/health")` |
| 7b | DB ping (`SELECT 1`) | `main.py:208-209` | PASS | `await session.execute(text("SELECT 1"))` |
| 7c | Scheduler running check | `main.py:216-218` | PASS | `scheduler.running` check, sets `degraded` if stopped |
| 7d | Last crawl time (`MAX(crawl_logs.created_at)`) | `main.py:224-225` | PASS | `select(func.max(CrawlLog.created_at))` |
| 7e | Returns `healthy`/`degraded`/`unhealthy` | `main.py:205-232` | PASS | All three states implemented with correct logic |

**Batch 7 Score: 5/5 (100%)**

---

### Batch 8: Code Deduplication

| # | Item | File | Status | Evidence |
|---|------|------|:------:|----------|
| 8a | `_calc_my_rank(latest_rankings, product_naver_id)` helper extracted | `services/product_service.py:144-150` | PASS | Standalone function, uses `_is_my_exact_product` |
| 8b | `_calc_last_crawled(active_keywords)` helper extracted | `services/product_service.py:153-160` | PASS | Standalone function iterating keywords |
| 8c | `_calc_my_rank` used in `get_product_list_items()` | `services/product_service.py:216` | PASS | `my_rank = _calc_my_rank(latest_rankings, product_naver_id)` |
| 8d | `_calc_my_rank` used in `get_product_detail()` | `services/product_service.py:306` | PASS | `my_rank = _calc_my_rank(latest_rankings, product_naver_id)` |
| 8e | `_calc_last_crawled` used in `get_product_list_items()` | `services/product_service.py:228` | PASS | `last_crawled = _calc_last_crawled(active_keywords)` |
| 8f | `_calc_last_crawled` used in `get_product_detail()` | `services/product_service.py:312` | PASS | `last_crawled = _calc_last_crawled(active_keywords)` |

**Batch 8 Score: 6/6 (100%)**

---

## 3. Overall Scores

| Batch | Category | Items | Implemented | Score | Status |
|:-----:|----------|:-----:|:-----------:|:-----:|:------:|
| 1 | Quick Wins | 2 | 2 | 100% | PASS |
| 2 | Crawling Error Isolation | 5 | 5 | 100% | PASS |
| 3 | asyncio.Lock Concurrency | 10 | 10 | 100% | PASS |
| 4 | N+1 Query Optimization | 4 | 4 | 100% | PASS |
| 5 | Data Retention + Indexes | 8 | 8 | 100% | PASS |
| 6 | httpx Client Consistency | 6 | 6 | 100% | PASS |
| 7 | Health Check Improvement | 5 | 5 | 100% | PASS |
| 8 | Code Deduplication | 6 | 6 | 100% | PASS |
| **Total** | | **46** | **46** | **100%** | **PASS** |

---

## 4. Match Rate Summary

```
+-----------------------------------------------+
|  Overall Match Rate: 100% (46/46)              |
+-----------------------------------------------+
|  PASS (Implemented as planned):  46 items      |
|  PARTIAL (Implemented differently): 0 items    |
|  MISSING (Not implemented):          0 items   |
+-----------------------------------------------+
```

---

## 5. Code Quality Observations

### 5.1 Positive Patterns

| Pattern | Location | Note |
|---------|----------|------|
| Consistent error isolation | `manager.py:222-230, 330-338` | Every `_save_keyword_result` call is wrapped in try-except, preventing one keyword failure from aborting the batch |
| Proper lock semantics | `manager.py:160-164, 241-245` | Pre-check `lock.locked()` before acquiring avoids silent queuing |
| Batch query with dict cache | `manager.py:268-283` | N+1 eliminated via single `.in_()` query + local dict lookup |
| Graceful health degradation | `main.py:205-232` | Three-tier status (`healthy` / `degraded` / `unhealthy`) with independent checks |
| Deduplication via helper extraction | `product_service.py:144-160` | `_calc_my_rank` and `_calc_last_crawled` are clean single-responsibility functions |

### 5.2 Minor Observations (Not Plan Gaps)

| Observation | File:Line | Severity | Note |
|-------------|-----------|:--------:|------|
| `cleanup_old_rankings` commits inside loop iterations | `jobs.py:89,106` | INFO | Each batch commits separately -- good for large datasets but could be slow on very large tables. Current 10k batch size is reasonable. |
| `_get_user_lock` / `_get_product_lock` not thread-safe | `manager.py:50-58` | INFO | Acceptable because asyncio is single-threaded. The dict mutation is not concurrent. |
| `alert_service` imports `defaultdict` inside function body | `alert_service.py:60,134` | INFO | Non-standard but harmless. Top-level import would be cleaner. |
| Health check opens two separate sessions | `main.py:207-230` | INFO | Could be consolidated into one session for DB ping + last crawl query. Minor optimization. |

---

## 6. Missing Features (Design O, Implementation X)

None. All 46 planned items are fully implemented.

---

## 7. Added Features (Design X, Implementation O)

The following items exist in the implementation but were not explicitly in the 8-batch plan (pre-existing or organically added):

| Item | Location | Note |
|------|----------|------|
| `excluded_malls` dual blacklist check | `manager.py:97,114` | mall_name-based blacklist in addition to naver_product_id -- present but not part of this plan |
| `my_product_ids` self-exclusion logic | `manager.py:98,122-127` | Auto-exclude own registered products -- pre-existing feature |
| `_is_my_exact_product` helper | `product_service.py:109-115` | Additional helper beyond the two specified in Batch 8 -- useful supporting function |
| `_calc_rank_change` helper | `product_service.py:118-141` | Another extracted helper -- not in plan but consistent with deduplication goals |

---

## 8. Recommended Actions

### 8.1 No Immediate Actions Required

All planned items are implemented. Match rate is 100%.

### 8.2 Optional Improvements (Low Priority)

| Priority | Item | File | Impact |
|----------|------|------|--------|
| LOW | Move `from collections import defaultdict` to top of file | `services/alert_service.py` | Code style consistency |
| LOW | Consolidate health check into single DB session | `main.py:207-230` | One fewer DB connection per health check |

---

## 9. Conclusion

The 8-batch backend improvement plan has been **fully implemented** with a **100% match rate** across all 46 verified items. No missing features, no deviations from the plan, and no critical issues found. The implementation is production-ready.

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-02-23 | Initial gap analysis | gap-detector |
