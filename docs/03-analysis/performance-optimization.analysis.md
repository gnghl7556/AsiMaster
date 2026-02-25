# Performance Optimization Gap Analysis Report

> **Analysis Type**: Gap Analysis (Plan vs Implementation)
>
> **Project**: AsiMaster
> **Analyst**: Claude Code (gap-detector)
> **Date**: 2026-02-24
> **Plan**: Backend Performance/Stability Improvements (5 Items)

---

## 1. Analysis Overview

### 1.1 Analysis Purpose

Verify whether 5 planned backend performance/stability improvements have been correctly implemented in the codebase. Each plan item specifies concrete function signatures, logic changes, and expected effects.

### 1.2 Analysis Scope

| Plan Item | Target File | Priority |
|-----------|-------------|----------|
| 1. N+1 Query Batch | `backend/app/services/product_service.py` | Critical |
| 2. price_snapshot History Load Removal | `backend/app/api/prices.py` | Critical |
| 3. Alert Dedup | `backend/app/services/alert_service.py` | High |
| 4. Blacklist DB Save | `backend/app/crawlers/manager.py` | High |
| 5. Shipping Fee Cache | `backend/app/crawlers/naver.py` + `manager.py` | High |

---

## 2. Gap Analysis (Plan vs Implementation)

### 2.1 Item 1: N+1 Query Batch (`product_service.py`)

| Requirement | Status | Evidence |
|-------------|--------|----------|
| `_fetch_sparkline_data_batch(db, all_keyword_ids, since)` function exists | ✅ Implemented | Lines 186-219 |
| Returns raw data: `{keyword_id: [(day, price+shipping, naver_product_id, mall_name)]}` | ✅ Match | Lines 193-194, query selects keyword_id, day, total_price, naver_product_id, mall_name |
| `_fetch_rank_change_batch(db, all_keyword_ids)` function exists | ✅ Implemented | Lines 297-326 |
| Returns raw data: `{keyword_id: [(rank, crawled_at, naver_product_id, is_my_store)]}` | ✅ Match | Lines 303-304, query selects keyword_id, rank, crawled_at, naver_product_id, is_my_store |
| Batch query for raw data, then per-product Python filtering for sparkline | ✅ Implemented | `_build_sparkline_from_batch()` at lines 222-241 applies excluded_ids/excluded_malls per product |
| Batch query for raw data, then per-product Python filtering for rank_change | ✅ Implemented | `_calc_rank_change_from_batch()` at lines 329-355 applies product_naver_id per product |
| `get_product_list_items()` loop uses batch results instead of individual calls | ✅ Implemented | Lines 417-418: batch calls before loop; Lines 448-452: per-product filtering from batch data |
| Individual `_fetch_sparkline_data()` / `_fetch_rank_change()` calls removed from loop | ✅ Confirmed | The loop (lines 421-475) does NOT call `_fetch_sparkline_data()` or `_fetch_rank_change()` -- only batch-derived helpers are used |
| Effect: ~100 queries reduced to ~3 queries | ✅ Achieved | 3 batch queries: `_fetch_latest_rankings` (line 411), `_fetch_sparkline_data_batch` (line 417), `_fetch_rank_change_batch` (line 418) |

**Score: 8/8 requirements met = 100%**

---

### 2.2 Item 2: price_snapshot History Load Removal (`prices.py`)

| Requirement | Status | Evidence |
|-------------|--------|----------|
| `selectinload(SearchKeyword.rankings)` removed | ✅ Confirmed | Lines 60-66: plain `select(SearchKeyword)` query with no eager loading of rankings |
| Keywords queried independently | ✅ Implemented | Lines 60-66: selects only SearchKeyword rows |
| `_fetch_latest_rankings()` imported from product_service.py | ✅ Implemented | Line 11: `from app.services.product_service import _fetch_latest_rankings` |
| Snapshot built from latest rankings per keyword | ✅ Implemented | Line 73: `latest_by_kw = await _fetch_latest_rankings(db, kw_ids)` then iterated at lines 76-91 |

**Score: 4/4 requirements met = 100%**

---

### 2.3 Item 3: Alert Dedup (`alert_service.py`)

| Requirement | Status | Evidence |
|-------------|--------|----------|
| `_has_recent_unread(db, user_id, product_id, alert_type, hours=24)` helper exists | ✅ Implemented | Lines 34-47, exact signature match with `hours: int = 24` default |
| Queries Alert table for unread alerts within N hours | ✅ Implemented | Lines 39-46: filters by user_id, product_id, type, is_read=False, created_at > now-hours |
| `check_price_undercut()`: dedup check before alert creation, returns on match | ✅ Implemented | Lines 107-109: checks `_has_recent_unread()` and `return` if True, placed right before `Alert()` creation |
| `check_rank_drop()`: dedup check before alert creation, continues on match | ✅ Implemented | Lines 184-185: checks `_has_recent_unread()` and `continue` if True, placed inside the keyword loop before `Alert()` creation |

**Score: 4/4 requirements met = 100%**

---

### 2.4 Item 4: Blacklist DB Save (`manager.py`)

| Requirement | Status | Evidence |
|-------------|--------|----------|
| Blacklist `continue` (2 lines) removed from `_save_keyword_result()` | ✅ Confirmed | Lines 124-164: no `continue` statements in the item loop; all items are saved to DB |
| `is_blacklisted` flag calculated | ✅ Implemented | Lines 132-135: `is_blacklisted` computed from `excluded_ids` and `excluded_malls` |
| Blacklisted items saved with `is_relevant=False` | ✅ Implemented | Line 141: `is_relevant = False if (is_blacklisted or is_my_product) else _check_relevance(item, product)` |
| Existing `is_my_product` logic preserved | ✅ Implemented | Lines 136-140: `is_my_product` check remains intact using `my_product_ids` |

**Score: 4/4 requirements met = 100%**

---

### 2.5 Item 5: Shipping Fee In-Memory Cache (`naver.py` + `manager.py`)

| Requirement | Status | Evidence |
|-------------|--------|----------|
| `NaverCrawler._shipping_cache: dict[str, int]` attribute | ✅ Implemented | `naver.py` line 82: `self._shipping_cache: dict[str, int] = {}` |
| `_enrich_shipping()` checks cache first, scrapes only on miss | ✅ Implemented | `naver.py` lines 139-148: checks `if npid and npid in cache` first, returns cached value; only scrapes on miss, then stores `cache[npid] = fee` |
| `clear_shipping_cache()` method exists | ✅ Implemented | `naver.py` lines 84-85: `def clear_shipping_cache(self): self._shipping_cache.clear()` |
| `_crawl_product_impl` calls `crawler.clear_shipping_cache()` at start | ✅ Implemented | `manager.py` line 182: `crawler.clear_shipping_cache()` as first line |
| `_crawl_user_all_impl` calls `crawler.clear_shipping_cache()` at start | ✅ Implemented | `manager.py` line 264: `crawler.clear_shipping_cache()` as first line |

**Score: 5/5 requirements met = 100%**

---

## 3. Overall Scores

| Category | Items Checked | Items Matched | Score | Status |
|----------|:------------:|:-------------:|:-----:|:------:|
| 1. N+1 Query Batch | 8 | 8 | 100% | ✅ |
| 2. price_snapshot Fix | 4 | 4 | 100% | ✅ |
| 3. Alert Dedup | 4 | 4 | 100% | ✅ |
| 4. Blacklist DB Save | 4 | 4 | 100% | ✅ |
| 5. Shipping Fee Cache | 5 | 5 | 100% | ✅ |
| **Overall** | **25** | **25** | **100%** | ✅ |

---

## 4. Missing Features (Plan O, Implementation X)

None found. All 25 requirements across 5 plan items are fully implemented.

---

## 5. Added Features (Plan X, Implementation O)

The implementation includes additional details not explicitly stated in the plan but consistent with its intent:

| Item | Implementation Location | Description |
|------|------------------------|-------------|
| `_build_sparkline_from_batch()` helper | `product_service.py:222-241` | Separate pure function for Python-side filtering of batch sparkline data. Plan implied this but did not name it explicitly. |
| `_calc_rank_change_from_batch()` helper | `product_service.py:329-355` | Separate pure function for Python-side filtering of batch rank data. Plan implied this but did not name it explicitly. |
| Old per-product functions retained | `product_service.py:142-294` | `_fetch_sparkline_data()` and `_fetch_rank_change()` still exist for use in `get_product_detail()` (single-product view). This is correct design -- batch is for list, individual is for detail. |

These additions are consistent with the plan's intent and do not represent divergence.

---

## 6. Changed Features (Plan != Implementation)

None found. All implementations match their plan specifications exactly.

---

## 7. Code Quality Notes

### 7.1 Batch Query Efficiency

The batch approach in `product_service.py` achieves the plan's target:

```
Before (per product in loop):
  - _fetch_latest_rankings() x N products
  - _fetch_sparkline_data() x N products
  - _fetch_rank_change() x N products
  = ~3N queries for N products

After (batch before loop):
  - _fetch_latest_rankings(all_keyword_ids)     -- 1 query
  - _fetch_sparkline_data_batch(all_keyword_ids) -- 1 query
  - _fetch_rank_change_batch(all_keyword_ids)    -- 1 query
  = 3 queries regardless of product count
```

### 7.2 Alert Dedup Correctness

The dedup check placement is correct in both functions:
- `check_price_undercut()`: dedup at line 108, right before Alert creation at line 113
- `check_rank_drop()`: dedup at line 185, right before Alert creation at line 192, using `continue` inside the keyword loop (not `return`)

### 7.3 Blacklist Save Logic

The blacklist save logic correctly unifies three exclusion sources into a single `is_relevant` flag:
1. `is_blacklisted` (excluded_ids + excluded_malls)
2. `is_my_product` (my_product_ids)
3. `_check_relevance()` (model_code + spec_keywords + price_range)

### 7.4 Shipping Cache Scope

Cache is correctly scoped per crawl session:
- `clear_shipping_cache()` called at the start of each `_crawl_product_impl` and `_crawl_user_all_impl`
- Within a single session, the same naver_product_id across different keywords will hit the cache
- Between sessions, cache is cleared to avoid stale shipping fees

---

## 8. Match Rate Summary

```
+---------------------------------------------+
|  Overall Match Rate: 100%                    |
+---------------------------------------------+
|  Total Requirements:  25                     |
|  Implemented:         25 (100%)              |
|  Missing:              0 (0%)               |
|  Changed:              0 (0%)               |
+---------------------------------------------+
|  Status: PASS -- All plan items implemented  |
+---------------------------------------------+
```

---

## 9. Recommended Actions

### 9.1 None Required

All 5 plan items are fully and correctly implemented. No gaps exist between the plan and the codebase.

### 9.2 Observations (Non-blocking)

| Observation | File | Notes |
|-------------|------|-------|
| Old per-product helpers retained | `product_service.py:142-294` | `_fetch_sparkline_data()` and `_fetch_rank_change()` are still used by `get_product_detail()`. This is intentional -- detail view only needs single-product data. Consider adding a comment noting this design choice. |
| Batch rank_change query has no WHERE filter for is_my_store | `product_service.py:309-318` | The batch query fetches ALL rankings for all keywords (not just is_my_store). This is by design since product_naver_id varies per product, but it fetches more rows than strictly necessary. For large datasets, consider adding a combined filter. |

---

## 10. Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-02-24 | Initial gap analysis | Claude Code (gap-detector) |
