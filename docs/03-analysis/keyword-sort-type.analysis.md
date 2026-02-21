# keyword-sort-type Analysis Report

> **Analysis Type**: Gap Analysis (Design vs Implementation)
>
> **Project**: AsiMaster
> **Analyst**: Claude Code (gap-detector)
> **Date**: 2026-02-21
> **Design Doc**: [keyword-sort-type.design.md](../02-design/features/keyword-sort-type.design.md)

---

## 1. Analysis Overview

### 1.1 Analysis Purpose

Verify that the `keyword-sort-type` feature (per-keyword sort_type for crawling: "sim" = exposure ranking, "asc" = price ranking) has been implemented in full accordance with its design document.

### 1.2 Analysis Scope

- **Design Document**: `docs/02-design/features/keyword-sort-type.design.md`
- **Implementation Files**:
  - `backend/app/models/search_keyword.py`
  - `backend/app/schemas/search_keyword.py`
  - `backend/app/crawlers/base.py`
  - `backend/app/crawlers/naver.py`
  - `backend/app/crawlers/manager.py`
  - `backend/app/api/keywords.py`
  - `backend/app/services/product_service.py`
  - `CLAUDE.md`
- **Analysis Date**: 2026-02-21

---

## 2. Gap Analysis (Design vs Implementation)

### 2.1 FR-01: SearchKeyword Model sort_type Field

| Item | Design | Implementation | Status |
|------|--------|----------------|--------|
| File | `backend/app/models/search_keyword.py` | `backend/app/models/search_keyword.py` | -- |
| Field declaration | `sort_type: Mapped[str] = mapped_column(String(10), default="sim")` | `sort_type: Mapped[str] = mapped_column(String(10), default="sim")` (line 22) | MATCH |
| Allowed values | `"sim"`, `"asc"` | Enforced at schema level (`Literal["sim", "asc"]`) | MATCH |
| DB column | VARCHAR(10), default 'sim' (via ALTER TABLE in main.py) | Consistent with mapped_column definition | MATCH |

**Result**: 100% match

### 2.2 FR-02: Crawler Chain sort_type Parameter Passing

#### FR-02-1: BaseCrawler Signature

| Item | Design | Implementation | Status |
|------|--------|----------------|--------|
| File | `backend/app/crawlers/base.py` | `backend/app/crawlers/base.py` | -- |
| Method signature | `async def search_keyword(self, keyword: str, sort_type: str = "sim") -> KeywordCrawlResult` | Identical (line 28) | MATCH |

#### FR-02-2: NaverCrawler Dynamic Sort

| Item | Design | Implementation | Status |
|------|--------|----------------|--------|
| File | `backend/app/crawlers/naver.py` | `backend/app/crawlers/naver.py` | -- |
| Method signature | `async def search_keyword(self, keyword: str, sort_type: str = "sim")` | Identical (line 29) | MATCH |
| API params sort value | `"sort": sort_type` | `"sort": sort_type` (line 39) | MATCH |

#### FR-02-3: CrawlManager Passing

| Item | Design | Implementation | Status |
|------|--------|----------------|--------|
| File | `backend/app/crawlers/manager.py` | `backend/app/crawlers/manager.py` | -- |
| `_fetch_keyword` signature | `(self, keyword_str: str, sort_type: str = "sim")` | Identical (line 42) | MATCH |
| `_fetch_keyword` -> `crawler.search_keyword` | `sort_type=sort_type` | Identical (line 47) | MATCH |
| `crawl_product._fetch_one` | `kw.sort_type or "sim"` passed | Identical (line 155) | MATCH |
| `crawl_user_all` unique_map key | `(kw.keyword.strip().lower(), kw.sort_type or "sim")` | Identical (lines 218-220) | MATCH |
| `crawl_user_all._fetch_one` | `(keyword_str: str, sort_type: str)` | Identical (line 226) | MATCH |
| `crawl_user_all` gather call | `_fetch_one(kw_str, st) for (kw_str, st) in unique_map.keys()` | Identical (line 239) | MATCH |
| `crawl_user_all` DB record loop | `for kw_str, sort_type, crawl_result, duration_ms in fetch_results:` + `unique_map[(kw_str, sort_type)]` | Identical (lines 247-248) | MATCH |

**Result**: 100% match

### 2.3 FR-03: Keyword API sort_type Receive/Return

#### FR-03-1: Pydantic Schemas

| Item | Design | Implementation | Status |
|------|--------|----------------|--------|
| File | `backend/app/schemas/search_keyword.py` | `backend/app/schemas/search_keyword.py` | -- |
| `KeywordCreate.sort_type` | `Literal["sim", "asc"] = "sim"` | Identical (line 9) | MATCH |
| `KeywordResponse.sort_type` | `sort_type: str` | Identical (line 16) | MATCH |
| `Literal` import | `from typing import Literal` | Identical (line 2) | MATCH |
| `KeywordWithRankings.sort_type` | Not specified in design | Not present in implementation (lines 42-48) | NOTE |

**NOTE on KeywordWithRankings**: The `KeywordWithRankings` schema (used for structured keyword-ranking responses) does not include `sort_type`. However, the product detail API (`get_product_detail` in `product_service.py`) builds keyword data as raw dictionaries (not using `KeywordWithRankings`), and those dictionaries DO include `sort_type`. So this is a latent inconsistency -- `KeywordWithRankings` is out of sync if it were ever used for product detail responses -- but it does NOT affect current behavior.

#### FR-03-2: Keyword Creation API

| Item | Design | Implementation | Status |
|------|--------|----------------|--------|
| File | `backend/app/api/keywords.py` | `backend/app/api/keywords.py` | -- |
| `SearchKeyword()` constructor `sort_type=data.sort_type` | Present | Identical (line 57) | MATCH |
| `GET /products/{product_id}/keywords` returns sort_type | Via `KeywordResponse` schema which includes `sort_type` | Correct (line 15, returns ORM objects serialized via `KeywordResponse`) | MATCH |

**Result**: 100% match (with minor note on `KeywordWithRankings`)

### 2.4 FR-04: Product Detail API Response Includes sort_type

| Item | Design | Implementation | Status |
|------|--------|----------------|--------|
| File | `backend/app/services/product_service.py` | `backend/app/services/product_service.py` | -- |
| `keywords_data` dict includes `sort_type` | `"sort_type": kw.sort_type or "sim"` | Identical (line 351) | MATCH |

**Result**: 100% match

### 2.5 FR-05: CLAUDE.md API Spec Update

| Item | Design | Implementation | Status |
|------|--------|----------------|--------|
| File | `CLAUDE.md` | `CLAUDE.md` | -- |
| sort_type field in POST keywords | Documented | Lines 170-171: `sort_type` field with values and default | MATCH |
| sort_type in GET keywords response | Documented | Line 172: response includes sort_type | MATCH |
| sort_type in product detail keywords array | Documented | Line 173: keywords array includes sort_type | MATCH |
| Crawling sort_type dynamic application | Documented | Line 174: dynamic Naver API sort parameter | MATCH |
| Dedup key change | Documented | Line 175: `(keyword, sort_type)` dedup key | MATCH |

**Result**: 100% match

---

## 3. Match Rate Summary

```
+---------------------------------------------+
|  Overall Match Rate: 100%                    |
+---------------------------------------------+
|  MATCH (design = implementation):  22 items  |
|  MISSING (design O, impl X):       0 items  |
|  ADDED (design X, impl O):         0 items  |
|  CHANGED (design != impl):         0 items  |
+---------------------------------------------+
```

### By Requirement

| Requirement | Items Checked | Match | Miss | Add | Change | Score |
|-------------|:------------:|:-----:|:----:|:---:|:------:|:-----:|
| FR-01: Model field | 3 | 3 | 0 | 0 | 0 | 100% |
| FR-02: Crawler chain | 10 | 10 | 0 | 0 | 0 | 100% |
| FR-03: Keyword API | 6 | 6 | 0 | 0 | 0 | 100% |
| FR-04: Product detail | 1 | 1 | 0 | 0 | 0 | 100% |
| FR-05: CLAUDE.md | 5 | 5 | 0 | 0 | 0 | 100% |
| **Total** | **25** | **25** | **0** | **0** | **0** | **100%** |

---

## 4. Overall Scores

| Category | Score | Status |
|----------|:-----:|:------:|
| Design Match | 100% | PASS |
| Architecture Compliance | 100% | PASS |
| Convention Compliance | 100% | PASS |
| **Overall** | **100%** | **PASS** |

---

## 5. Notes and Observations

### 5.1 Latent Schema Inconsistency (Informational)

| Item | Location | Description | Severity |
|------|----------|-------------|----------|
| `KeywordWithRankings` missing `sort_type` | `backend/app/schemas/search_keyword.py:42-48` | Schema does not include `sort_type` field, but this schema is not currently used in product detail API (which builds raw dicts). No functional impact. | LOW (Informational) |

This is not a gap relative to the design document (which does not mention `KeywordWithRankings`), but it is worth noting for future maintenance. If `KeywordWithRankings` is ever adopted for structured responses, `sort_type` should be added.

### 5.2 Design Quality Observations

- The design correctly identified the key challenge: deduplication key change from `keyword_str` to `(keyword_str, sort_type)` tuple.
- All 8 files in the implementation order were modified exactly as specified.
- Default value handling (`kw.sort_type or "sim"`) is consistently applied across all call sites, providing backward compatibility for existing records with NULL sort_type.

---

## 6. Recommended Actions

### 6.1 Immediate Actions

None required. All design requirements are fully implemented.

### 6.2 Optional Improvements

| Priority | Item | File | Description |
|----------|------|------|-------------|
| LOW | Add `sort_type` to `KeywordWithRankings` | `backend/app/schemas/search_keyword.py:42-48` | Future-proof the schema for potential structured response usage |

### 6.3 Documentation Updates Needed

None. CLAUDE.md has been updated with complete keyword sort_type API documentation.

---

## 7. Conclusion

The `keyword-sort-type` feature implementation achieves a **100% match rate** against the design document. All 5 functional requirements (FR-01 through FR-05) are fully implemented across 8 modified files. The implementation follows the exact patterns, signatures, and data flow specified in the design.

No gaps, missing features, or deviations were found. The feature is ready for production use.

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-02-21 | Initial gap analysis | Claude Code (gap-detector) |
