# naver_product_id Self-Product Matching Analysis Report

> **Analysis Type**: Gap Analysis (Design vs Implementation)
>
> **Project**: AsiMaster
> **Analyst**: Claude Code (gap-detector)
> **Date**: 2026-02-22
> **Status**: Draft

---

## 1. Analysis Overview

### 1.1 Analysis Purpose

Verify completeness and correctness of the "naver_product_id self-product matching" feature.
When a user imports products from their smart store, each product's `naver_product_id` is saved.
During crawling, if a search result's `naver_product_id` matches the monitored product's own ID,
it is automatically marked `is_relevant = false` (self-exclusion from competitor metrics).

### 1.2 Analysis Scope

- **Feature**: Self-product exclusion via naver_product_id matching during crawling
- **Files Changed**: 6 backend files
- **Frontend Integration**: Store import page + API client + TypeScript types
- **Analysis Date**: 2026-02-22

### 1.3 Files Analyzed

| File | Layer | Purpose |
|------|-------|---------|
| `backend/app/models/product.py` | Data Model | `naver_product_id` column |
| `backend/app/schemas/product.py` | Schema | ProductCreate/Update/Response |
| `backend/app/schemas/store_import.py` | Schema | StoreImportItem |
| `backend/app/api/store_import.py` | API | Import endpoint saves naver_product_id |
| `backend/app/crawlers/manager.py` | Service | `is_self` check in _save_keyword_result |
| `backend/app/main.py` | Migration | ALTER TABLE for naver_product_id |
| `backend/app/services/product_service.py` | Service | lowest_price/sparkline/competitors |
| `backend/app/services/alert_service.py` | Service | Alert generation |
| `frontend/src/lib/api/products.ts` | API Client | importStoreProducts function |
| `frontend/src/types/index.ts` | Types | StoreProduct, Product types |
| `frontend/src/app/settings/store-import/page.tsx` | UI | Import page |

---

## 2. Gap Analysis (Design vs Implementation)

### 2.1 Data Flow Completeness

#### A. Store Preview -> Frontend (OK)

| Step | Status | Details |
|------|:------:|---------|
| Naver API returns `productId` | OK | `naver.py:63` -- `str(item.get("productId", ""))` |
| `store_scraper.py` includes it in `StoreProduct` | OK | `store_scraper.py:19` -- `naver_product_id: str` |
| API returns it in `StoreProductItem` | OK | `store_import.py:10` -- `naver_product_id: str` |
| Frontend `StoreProduct` type has it | OK | `types/index.ts:76` -- `naver_product_id: string` |

#### B. Frontend -> Import API (CRITICAL GAP FOUND)

| Step | Status | Details |
|------|:------:|---------|
| `StoreImportItem` schema accepts it | OK | `store_import.py:20` -- `naver_product_id: str \| None = None` |
| Frontend `importStoreProducts` sends it | **MISSING** | `products.ts:67-73` -- **`naver_product_id` NOT included in payload** |
| Import endpoint saves it to Product | OK | `store_import.py:87` -- `naver_product_id=item.naver_product_id` |

**Evidence** -- the frontend import call at `frontend/src/lib/api/products.ts:67-73`:

```typescript
importStoreProducts: (
  userId: number,
  products: { name: string; selling_price: number; image_url?: string; category?: string; keywords?: string[] }[]
) =>
```

The type signature does NOT include `naver_product_id`. The page component at
`frontend/src/app/settings/store-import/page.tsx:130-141` confirms:

```typescript
selectedProducts.map((p) => ({
  name: p.name,
  selling_price: p.price,
  image_url: p.image_url || undefined,
  category: p.category || undefined,
  keywords: Array.from(selectedKeywords.get(p.naver_product_id) || []),
  // naver_product_id is NOT mapped here
}))
```

**Impact**: HIGH -- Even though the backend schema and import endpoint are ready to receive and
save `naver_product_id`, the frontend never sends it. All imported products will have
`naver_product_id = null` in the database, making the self-exclusion feature completely
non-functional for store-imported products.

#### C. Import -> DB Save (OK, conditional on data received)

| Step | Status | Details |
|------|:------:|---------|
| `StoreImportItem.naver_product_id` | OK | Optional field with default None |
| Product creation includes it | OK | `store_import.py:87` -- `naver_product_id=item.naver_product_id` |

#### D. Manual Product Creation (OK)

| Step | Status | Details |
|------|:------:|---------|
| `ProductCreate` accepts `naver_product_id` | OK | `product.py:14` -- `naver_product_id: str \| None` |
| `create_product` saves via `**data.model_dump()` | OK | `products.py:49` -- all fields from schema are passed |

### 2.2 Crawling Logic Correctness

#### is_self Check in `_save_keyword_result` (OK with caveats)

**Implementation** at `manager.py:94-100`:

```python
is_self = (
    product
    and product.naver_product_id
    and item.naver_product_id == product.naver_product_id
)
is_relevant = False if is_self else _check_relevance(item, product)
```

| Check | Status | Details |
|-------|:------:|---------|
| Null-safe when `product` is None | OK | `product and ...` short-circuits |
| Null-safe when `product.naver_product_id` is None | OK | Falsy check prevents comparison |
| Null-safe when `item.naver_product_id` is empty string | CAUTION | Empty string `""` is falsy in Python on the left side, but the check is on `product.naver_product_id`. If `item.naver_product_id == ""` and `product.naver_product_id == ""`, `is_self` would be True (false positive). However, `product.naver_product_id` from DB defaults to `None` (not `""`), so this is safe in practice. |
| `crawl_product()` passes product object | OK | `manager.py:170-174` -- `product=product` |
| `crawl_user_all()` passes product from cache | OK | `manager.py:255-261` -- `product=products_cache.get(kw.product_id)` |

#### Edge Case: Same naver_product_id on two different Products

This is theoretically impossible (each Naver product has a unique ID), but if it somehow happened,
both products would self-exclude the same search result entry. This is the correct behavior --
each product only self-excludes the entry matching its own `naver_product_id`.

### 2.3 Schema & Migration

| Item | Status | Details |
|------|:------:|---------|
| ALTER TABLE for `products.naver_product_id` | OK | `main.py:28` -- `VARCHAR(50)`, NULL default |
| `ProductResponse` includes `naver_product_id` | OK | `product.py:43` |
| `ProductDetail` includes `naver_product_id` | **MISSING** | `product.py:121-146` -- NOT present |
| `ProductListItem` includes `naver_product_id` | Not needed | List view does not need this field |
| `ProductUpdate` includes `naver_product_id` | OK | `product.py:25` |

**ProductDetail Gap**: The `ProductDetail` Pydantic schema at `backend/app/schemas/product.py:121-146`
does NOT include `naver_product_id`. However, `get_product_detail()` in `product_service.py:380-405`
does NOT return it either -- the response dict does not contain `naver_product_id` field.
This means the product detail page cannot display or verify a product's `naver_product_id`.

The frontend `ProductDetail` type at `frontend/src/types/index.ts:112-130` also lacks
`naver_product_id`, which is consistent with the backend but represents a missing feature.

### 2.4 Downstream Service Consistency

#### product_service.py (OK)

The service layer uses `is_relevant` filtering throughout:

| Metric | Filters by `is_relevant` | Self-excluded items filtered? |
|--------|:------------------------:|:-----------------------------:|
| Lowest price | OK -- `r.is_relevant` at line 138 | Yes (is_relevant=False) |
| Sparkline | OK -- `r.is_relevant` at line 173 | Yes |
| Competitors | OK -- `r.is_relevant` at line 330 | Yes (visible but dimmed) |
| Keyword rankings | OK -- shows all but blacklist-excluded | Self-excluded visible as non-relevant |

Since self-excluded items are saved with `is_relevant = False`, they are automatically excluded
from lowest_price, sparkline, and relevant competitor calculations. This is correct.

#### alert_service.py (OK for this feature)

`check_price_undercut()` at `alert_service.py:54` queries with `KeywordRanking.is_relevant == True`.
Self-excluded items (`is_relevant = False`) will NOT trigger false price alerts.
This is a significant improvement over the previously identified gap where alert_service
did not filter by relevance (that issue was fixed before this feature was added).

### 2.5 Frontend Type Gaps

| Type | `naver_product_id` field | Status |
|------|:------------------------:|:------:|
| `Product` (`types/index.ts:10-23`) | **MISSING** | Product type lacks `naver_product_id` |
| `ProductDetail` (`types/index.ts:112-130`) | **MISSING** | Detail type lacks `naver_product_id` |
| `StoreProduct` (`types/index.ts:71-78`) | Present | OK |
| `RankingItem` (`types/index.ts:49-61`) | Present | OK (for search result items) |

---

## 3. Differences Found

### 3.1 CRITICAL: Frontend Import Does Not Send naver_product_id

| Category | Detail |
|----------|--------|
| **Type** | Missing Feature (Design OK, Implementation Incomplete) |
| **Location** | `frontend/src/lib/api/products.ts:67-73` |
| **Location** | `frontend/src/app/settings/store-import/page.tsx:130-141` |
| **Impact** | HIGH -- Self-exclusion feature completely non-functional |
| **Root Cause** | Frontend import API call type signature and page mapping omit `naver_product_id` |

**Fix Required**: Add `naver_product_id` to the import payload.

In `frontend/src/lib/api/products.ts`:
```typescript
importStoreProducts: (
  userId: number,
  products: {
    name: string;
    selling_price: number;
    image_url?: string;
    category?: string;
    naver_product_id?: string;  // <-- ADD THIS
    keywords?: string[];
  }[]
) => ...
```

In `frontend/src/app/settings/store-import/page.tsx`:
```typescript
selectedProducts.map((p) => ({
  name: p.name,
  selling_price: p.price,
  image_url: p.image_url || undefined,
  category: p.category || undefined,
  naver_product_id: p.naver_product_id,  // <-- ADD THIS
  keywords: Array.from(selectedKeywords.get(p.naver_product_id) || []),
}))
```

### 3.2 MODERATE: ProductDetail Schema Missing naver_product_id

| Category | Detail |
|----------|--------|
| **Type** | Missing Field (Backend schema + service omission) |
| **Location** | `backend/app/schemas/product.py:121-146` (ProductDetail) |
| **Location** | `backend/app/services/product_service.py:380-405` (response dict) |
| **Impact** | MODERATE -- UI cannot display/verify product's naver_product_id |

**Fix Required**: Add `naver_product_id` to `ProductDetail` schema and to the response dict
in `get_product_detail()`.

### 3.3 LOW: Frontend Product Type Missing naver_product_id

| Category | Detail |
|----------|--------|
| **Type** | Incomplete Type Definition |
| **Location** | `frontend/src/types/index.ts:10-23` (Product interface) |
| **Impact** | LOW -- The `Product` type is used for create/update responses; without this field, TypeScript won't surface it in editor autocomplete |

### 3.4 INFO: Existing Products Have No naver_product_id

| Category | Detail |
|----------|--------|
| **Type** | Known Limitation |
| **Impact** | LOW -- Acceptable tradeoff |
| **Detail** | Products registered before this feature will have `naver_product_id = null`. They won't benefit from self-exclusion but will continue to work normally. No backfill migration is possible without re-crawling or re-importing. |

---

## 4. Backend Logic Quality

### 4.1 Self-Exclusion Logic in manager.py

| Aspect | Assessment | Notes |
|--------|:----------:|-------|
| Null safety | OK | Short-circuit evaluation prevents NoneType errors |
| Position in flow | OK | Checked AFTER blacklist skip (line 84-88), BEFORE DB insert |
| Interaction with _check_relevance | OK | Bypasses relevance check when is_self=True |
| is_relevant value | OK | Correctly set to False for self-products |
| Item still saved to DB | OK | Self-product appears in rankings with is_relevant=False (visible but excluded from metrics) |

### 4.2 Potential Edge Cases

| Edge Case | Handling | Status |
|-----------|----------|:------:|
| product.naver_product_id is None (manual product) | `is_self` = False, falls through to _check_relevance | OK |
| item.naver_product_id is "" (Naver API returns no productId) | "" != product.naver_product_id (which is a real ID), `is_self` = False | OK |
| product.naver_product_id is "" (empty string stored) | `""` is falsy in Python, `is_self` = False | OK |
| Same store, different product (e.g., user sells 2 products from same store) | Only exact naver_product_id match triggers self-exclusion; other store products remain visible | OK |
| Product is both self AND blacklisted | Blacklist check (lines 85-88) runs first with `continue`, so blacklisted items are skipped entirely before is_self check | OK |

---

## 5. Match Rate Summary

```
+-----------------------------------------------+
|  Overall Feature Match Rate: 72%               |
+-----------------------------------------------+
|  Backend Model/Schema:       6/7  (86%)        |
|  Backend Logic (crawler):    5/5  (100%)       |
|  Backend Service Layer:      4/4  (100%)       |
|  Frontend Data Flow:         1/3  (33%)        |
|  Migration:                  1/1  (100%)       |
+-----------------------------------------------+
|  OK Items:                  17                  |
|  CRITICAL Gaps:              1                  |
|  MODERATE Gaps:              1                  |
|  LOW Gaps:                   2                  |
+-----------------------------------------------+
```

---

## 6. Recommended Actions

### 6.1 Immediate (CRITICAL -- feature is non-functional without this)

| Priority | Item | Files | Impact |
|:--------:|------|-------|--------|
| 1 | Add `naver_product_id` to frontend import API call and page mapping | `frontend/src/lib/api/products.ts:67-73`, `frontend/src/app/settings/store-import/page.tsx:130-141` | Self-exclusion feature will start working |

### 6.2 Short-term (MODERATE -- completeness)

| Priority | Item | Files | Impact |
|:--------:|------|-------|--------|
| 2 | Add `naver_product_id` to `ProductDetail` Pydantic schema | `backend/app/schemas/product.py:121-146` | Product detail API returns the field |
| 3 | Add `naver_product_id` to `get_product_detail()` response dict | `backend/app/services/product_service.py:380-405` | Service layer includes the field |
| 4 | Add `naver_product_id` to frontend `Product` and `ProductDetail` types | `frontend/src/types/index.ts` | Type safety and editor support |

### 6.3 Long-term (LOW -- nice to have)

| Priority | Item | Notes |
|:--------:|------|-------|
| 5 | Consider a "Re-import" or "Refresh store data" feature | Would backfill naver_product_id for existing products |
| 6 | Add UI indicator on product detail showing self-exclusion is active | When product has naver_product_id set, show badge |

---

## 7. CLAUDE.md Documentation Update Needed

The following should be added to the API change history:

```markdown
### 2026-02-22: Self-Product Matching (naver_product_id)
- `Product` model: `naver_product_id` field added (VARCHAR(50), nullable)
- `ProductCreate`, `ProductUpdate`, `ProductResponse`: `naver_product_id` field added
- `StoreImportItem`: `naver_product_id` field added
- Store import endpoint saves `naver_product_id` to Product
- Crawling: `_save_keyword_result()` auto-marks self-products as `is_relevant=False`
- Products with matching `naver_product_id` excluded from lowest_price/sparkline/alerts
```

---

## 8. Next Steps

- [ ] Fix CRITICAL gap: frontend import must send `naver_product_id`
- [ ] Fix MODERATE gap: add `naver_product_id` to ProductDetail schema and service
- [ ] Fix LOW gap: update frontend TypeScript types
- [ ] Verify fix: import a product, run crawl, confirm self-exclusion works
- [ ] Update CLAUDE.md with API changes

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-02-22 | Initial analysis | Claude Code (gap-detector) |
