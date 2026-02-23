# Gap Analysis: code-quality (Phase 6)

## Analysis Overview
- **Feature**: Phase 6 - Code Quality Improvements
- **Analysis Date**: 2026-02-23
- **Match Rate**: 100%
- **Status**: PASS

## Items Verified

| # | Plan Item | Status | Files |
|---|-----------|:------:|-------|
| 6-1 | `datetime.utcnow()` -> `utcnow()` helper | PASS | 6 files (1 new + 5 modified) |
| 6-2 | Code dedup helpers in product_service.py | PASS | 4 helpers extracted |
| 6-3 | Business logic separation (excluded_service.py) | PASS | 2 files (1 new + 1 modified) |
| 6-4 | ZeroDivisionError defense | PASS | 2 guard locations |
| 6-5 | LIKE search escaping | PASS | 3 chars escaped |

## File Changes

| File | Type | Change |
|------|------|--------|
| `backend/app/core/utils.py` | NEW | `utcnow()` helper |
| `backend/app/services/product_service.py` | MODIFIED | utcnow, 4 helpers, ZeroDivision guard, LIKE escape |
| `backend/app/services/excluded_service.py` | NEW | Blacklist business logic |
| `backend/app/api/products.py` | MODIFIED | Blacklist endpoints -> service calls |
| `backend/app/crawlers/manager.py` | MODIFIED | utcnow |
| `backend/app/scheduler/jobs.py` | MODIFIED | utcnow |
| `backend/app/api/crawl.py` | MODIFIED | utcnow |
| `backend/app/api/prices.py` | MODIFIED | utcnow |

## Verification Details

### 6-1: Zero `datetime.utcnow()` remaining
- `grep -r "datetime.utcnow" backend/` -> 0 matches

### 6-2: Extracted Helpers
- `_filter_relevant()`: Used in both get_product_list_items and get_product_detail
- `_find_lowest()`: Used in both functions
- `_build_sparkline()`: Used in both functions
- `_calc_price_gap()`: Used in both functions (also covers 6-4)

### 6-3: Service Layer
- `get_excluded_list()`, `add_excluded()`, `remove_excluded()` all in excluded_service.py
- API router reduced from ~110 lines to ~15 lines for blacklist endpoints

### 6-4: ZeroDivision Guards
- `calculate_status()`: `lowest_price == 0` -> "losing"
- `_calc_price_gap()`: `lowest_price > 0` check before division

### 6-5: LIKE Escape
- Escapes `\` -> `\\`, `%` -> `\%`, `_` -> `\_` (correct order)

## Conclusion
All 5 plan items fully implemented. No gaps detected.
