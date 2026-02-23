# naver-full-fields Analysis Report

> **Analysis Type**: Gap Analysis (Design vs Implementation)
>
> **Project**: AsiMaster
> **Analyst**: gap-detector
> **Date**: 2026-02-22
> **Design Doc**: Inline Plan (12 items across 14 files)

---

## 1. Analysis Overview

### 1.1 Analysis Purpose

Verify that all 12 planned changes for the "naver-full-fields" feature are correctly implemented. The feature adds 8 new fields from the Naver Shopping API (hprice, brand, maker, product_type, category1~4) throughout the data pipeline: crawling, storage, schema, service layer, and a new categories API endpoint.

### 1.2 Analysis Scope

- **Design Document**: Inline plan (12 items)
- **Implementation Path**: `backend/app/` (crawlers, models, schemas, services, api)
- **Analysis Date**: 2026-02-22

---

## 2. Gap Analysis (Design vs Implementation)

### 2.1 Item 1: `backend/app/crawlers/base.py` -- RankingItem Dataclass

| Field | Design | Implementation | Status |
|-------|--------|----------------|--------|
| hprice | `int = 0` | `hprice: int = 0` (line 14) | MATCH |
| brand | `str = ""` | `brand: str = ""` (line 15) | MATCH |
| maker | `str = ""` | `maker: str = ""` (line 16) | MATCH |
| product_type | `str = ""` | `product_type: str = ""` (line 17) | MATCH |
| category1 | `str = ""` | `category1: str = ""` (line 18) | MATCH |
| category2 | `str = ""` | `category2: str = ""` (line 19) | MATCH |
| category3 | `str = ""` | `category3: str = ""` (line 20) | MATCH |
| category4 | `str = ""` | `category4: str = ""` (line 21) | MATCH |

**Result**: 8/8 fields -- MATCH

---

### 2.2 Item 2: `backend/app/crawlers/naver.py` -- Naver API Extraction

| Field | Design | Implementation | Status |
|-------|--------|----------------|--------|
| hprice | Extract with empty-string defense | `int(item.get("hprice", 0) or 0)` (line 64) | MATCH |
| brand | Extract from response | `item.get("brand", "")` (line 65) | MATCH |
| maker | Extract from response | `item.get("maker", "")` (line 66) | MATCH |
| product_type | Extract from response | `str(item.get("productType", ""))` (line 67) | MATCH |
| category1 | Extract from response | `item.get("category1", "")` (line 68) | MATCH |
| category2 | Extract from response | `item.get("category2", "")` (line 69) | MATCH |
| category3 | Extract from response | `item.get("category3", "")` (line 70) | MATCH |
| category4 | Extract from response | `item.get("category4", "")` (line 71) | MATCH |

Note: `hprice` uses `int(... or 0)` which handles both empty string `""` and `None` cases -- robust defense as designed.

**Result**: 8/8 fields -- MATCH

---

### 2.3 Item 3: `backend/app/models/keyword_ranking.py` -- DB Columns

| Column | Design Type | Implementation | Status |
|--------|-------------|----------------|--------|
| hprice | `Integer, default=0` | `Mapped[int] = mapped_column(Integer, default=0)` (line 27) | MATCH |
| brand | `String(200), nullable` | `Mapped[str \| None] = mapped_column(String(200))` (line 28) | MATCH |
| maker | `String(200), nullable` | `Mapped[str \| None] = mapped_column(String(200))` (line 29) | MATCH |
| product_type | `String(10), nullable` | `Mapped[str \| None] = mapped_column(String(10))` (line 30) | MATCH |
| category1 | `String(100), nullable` | `Mapped[str \| None] = mapped_column(String(100))` (line 31) | MATCH |
| category2 | `String(100), nullable` | `Mapped[str \| None] = mapped_column(String(100))` (line 32) | MATCH |
| category3 | `String(100), nullable` | `Mapped[str \| None] = mapped_column(String(100))` (line 33) | MATCH |
| category4 | `String(100), nullable` | `Mapped[str \| None] = mapped_column(String(100))` (line 34) | MATCH |

**Result**: 8/8 columns -- MATCH

---

### 2.4 Item 4: `backend/app/main.py` -- ALTER TABLE Statements

| Column | Design | Implementation (alter_statements list) | Status |
|--------|--------|----------------------------------------|--------|
| hprice | `INTEGER DEFAULT 0` | `("keyword_rankings", "hprice", "INTEGER", "0")` (line 35) | MATCH |
| brand | `VARCHAR(200) nullable` | `("keyword_rankings", "brand", "VARCHAR(200)", None)` (line 36) | MATCH |
| maker | `VARCHAR(200) nullable` | `("keyword_rankings", "maker", "VARCHAR(200)", None)` (line 37) | MATCH |
| product_type | `VARCHAR(10) nullable` | `("keyword_rankings", "product_type", "VARCHAR(10)", None)` (line 38) | MATCH |
| category1 | `VARCHAR(100) nullable` | `("keyword_rankings", "category1", "VARCHAR(100)", None)` (line 39) | MATCH |
| category2 | `VARCHAR(100) nullable` | `("keyword_rankings", "category2", "VARCHAR(100)", None)` (line 40) | MATCH |
| category3 | `VARCHAR(100) nullable` | `("keyword_rankings", "category3", "VARCHAR(100)", None)` (line 41) | MATCH |
| category4 | `VARCHAR(100) nullable` | `("keyword_rankings", "category4", "VARCHAR(100)", None)` (line 42) | MATCH |

Cross-verification: ALTER TABLE types match model column types exactly (INTEGER/0, VARCHAR(200)/None, VARCHAR(10)/None, VARCHAR(100)/None).

**Result**: 8/8 statements -- MATCH

---

### 2.5 Item 5: `backend/app/crawlers/manager.py` -- KeywordRanking Creation Mapping

| Field | Design | Implementation (lines 113-121) | Status |
|-------|--------|-------------------------------|--------|
| hprice | Map from item.hprice | `hprice=item.hprice` (line 113) | MATCH |
| brand | Map from item.brand | `brand=item.brand` (line 114) | MATCH |
| maker | Map from item.maker | `maker=item.maker` (line 115) | MATCH |
| product_type | Map from item.product_type | `product_type=item.product_type` (line 116) | MATCH |
| category1 | Map from item.category1 | `category1=item.category1` (line 117) | MATCH |
| category2 | Map from item.category2 | `category2=item.category2` (line 118) | MATCH |
| category3 | Map from item.category3 | `category3=item.category3` (line 119) | MATCH |
| category4 | Map from item.category4 | `category4=item.category4` (line 120) | MATCH |

**Result**: 8/8 mappings -- MATCH

---

### 2.6 Item 6: `backend/app/schemas/search_keyword.py` -- Schema Updates

#### RankingItemResponse (8 fields)

| Field | Design | Implementation | Status |
|-------|--------|----------------|--------|
| hprice | `int = 0` | `hprice: int = 0` (line 37) | MATCH |
| brand | `str \| None = None` | `brand: str \| None = None` (line 38) | MATCH |
| maker | `str \| None = None` | `maker: str \| None = None` (line 39) | MATCH |
| product_type | `str \| None = None` | `product_type: str \| None = None` (line 40) | MATCH |
| category1 | `str \| None = None` | `category1: str \| None = None` (line 41) | MATCH |
| category2 | `str \| None = None` | `category2: str \| None = None` (line 42) | MATCH |
| category3 | `str \| None = None` | `category3: str \| None = None` (line 43) | MATCH |
| category4 | `str \| None = None` | `category4: str \| None = None` (line 44) | MATCH |

#### KeywordWithRankings (sort_type)

| Field | Design | Implementation | Status |
|-------|--------|----------------|--------|
| sort_type | `str = "sim"` | `sort_type: str = "sim"` (line 53) | MATCH |

**Result**: 9/9 fields -- MATCH

---

### 2.7 Item 7: `backend/app/schemas/product.py` -- CompetitorSummary

| Field | Design | Implementation | Status |
|-------|--------|----------------|--------|
| hprice | `int = 0` | `hprice: int = 0` (line 95) | MATCH |
| brand | `str \| None = None` | `brand: str \| None = None` (line 96) | MATCH |
| maker | `str \| None = None` | `maker: str \| None = None` (line 97) | MATCH |

**Result**: 3/3 fields -- MATCH

---

### 2.8 Item 8: `backend/app/services/product_service.py` -- Service Layer

#### competitors dict (hprice, brand, maker)

| Field | Design | Implementation (lines 323-334) | Status |
|-------|--------|-------------------------------|--------|
| hprice | Include in competitors | `"hprice": r.hprice or 0` (line 331) | MATCH |
| brand | Include in competitors | `"brand": r.brand` (line 332) | MATCH |
| maker | Include in competitors | `"maker": r.maker` (line 333) | MATCH |

#### keywords_data rankings dict (8 fields)

| Field | Design | Implementation (lines 358-379) | Status |
|-------|--------|-------------------------------|--------|
| hprice | Include in rankings | `"hprice": r.hprice or 0` (line 370) | MATCH |
| brand | Include in rankings | `"brand": r.brand` (line 371) | MATCH |
| maker | Include in rankings | `"maker": r.maker` (line 372) | MATCH |
| product_type | Include in rankings | `"product_type": r.product_type` (line 373) | MATCH |
| category1 | Include in rankings | `"category1": r.category1` (line 374) | MATCH |
| category2 | Include in rankings | `"category2": r.category2` (line 375) | MATCH |
| category3 | Include in rankings | `"category3": r.category3` (line 376) | MATCH |
| category4 | Include in rankings | `"category4": r.category4` (line 377) | MATCH |

**Result**: 11/11 field references -- MATCH

---

### 2.9 Item 9: `backend/app/api/categories.py` -- NEW FILE

| Aspect | Design | Implementation | Status |
|--------|--------|----------------|--------|
| File exists | New file required | File exists (70 lines) | MATCH |
| Endpoint URL | `GET /naver-categories` | `@router.get("/naver-categories")` (line 10) | MATCH |
| Query | DISTINCT category1~4 GROUP BY | SQL with GROUP BY category1,2,3,4 (lines 13-24) | MATCH |
| Response: categories | Tree structure (name, product_count, children) | Nested dict -> _to_list() with name, product_count, children (lines 53-64) | MATCH |
| Response: total_paths | Count of unique paths | `total_paths` counter (line 29, returned line 68) | MATCH |
| Sorting | product_count descending | `key=lambda x: -x["product_count"]` (line 63) | MATCH |
| Null filter | Exclude null/empty category1 | `WHERE category1 IS NOT NULL AND category1 != ''` (line 22) | MATCH |

**Result**: 7/7 aspects -- MATCH

---

### 2.10 Item 10: `backend/app/api/router.py` -- Register categories_router

| Aspect | Design | Implementation | Status |
|--------|--------|----------------|--------|
| Import | `from app.api.categories import router as categories_router` | Present (line 4) | MATCH |
| Registration | `api_router.include_router(categories_router)` | Present (line 28) | MATCH |

**Result**: 2/2 aspects -- MATCH

---

### 2.11 Item 11: Store Import Files (brand/maker)

#### `backend/app/crawlers/store_scraper.py` -- StoreProduct dataclass

| Field | Design | Implementation | Status |
|-------|--------|----------------|--------|
| brand | `str = ""` | `brand: str = ""` (line 21) | MATCH |
| maker | `str = ""` | `maker: str = ""` (line 22) | MATCH |
| API extraction | Extract brand/maker from Naver response | `brand=item.get("brand", "")` (line 282), `maker=item.get("maker", "")` (line 283) | MATCH |

#### `backend/app/schemas/store_import.py` -- StoreProductItem

| Field | Design | Implementation | Status |
|-------|--------|----------------|--------|
| brand | `str = ""` | `brand: str = ""` (line 12) | MATCH |
| maker | `str = ""` | `maker: str = ""` (line 13) | MATCH |

#### `backend/app/api/store_import.py` -- Preview Response

| Field | Design | Implementation | Status |
|-------|--------|----------------|--------|
| brand | Include in preview | `brand=p.brand` (line 45) | MATCH |
| maker | Include in preview | `maker=p.maker` (line 46) | MATCH |

**Result**: 8/8 aspects -- MATCH

---

### 2.12 Item 12: `CLAUDE.md` -- API Changelog Entry

| Aspect | Design | Implementation | Status |
|--------|--------|----------------|--------|
| Changelog section exists | Add entry for naver-full-fields | Section "2026-02-22: Naver API 전체 필드 저장 + 카테고리 트리 API" (line 213) | MATCH |
| 8 field descriptions | Document hprice, brand, maker, product_type, category1~4 | All listed (lines 215-219) | MATCH |
| Schema changes documented | RankingItemResponse, CompetitorSummary, etc. | All documented (lines 221-225) | MATCH |
| New API documented | GET /naver-categories | Documented with response format (lines 227-231) | MATCH |
| Crawling changes documented | 8 fields extraction | Documented (lines 233-235) | MATCH |
| New file documented | categories.py | Documented (lines 237-238) | MATCH |
| API endpoints section | Add naver-categories | `GET /api/v1/naver-categories` (line 86) | MATCH |
| Feature list | Add items 14, 15 | Items 14 and 15 added (lines 109-110) | MATCH |

**Result**: 8/8 aspects -- MATCH

---

## 3. Cross-Verification: Type Consistency

Verifying that types are consistent across all layers:

| Field | Dataclass (base.py) | Model (keyword_ranking.py) | Schema (search_keyword.py) | Service (product_service.py) | Consistent? |
|-------|---------------------|---------------------------|---------------------------|------------------------------|-------------|
| hprice | `int = 0` | `Integer, default=0` | `int = 0` | `r.hprice or 0` | MATCH |
| brand | `str = ""` | `String(200), nullable` | `str \| None = None` | `r.brand` | MATCH |
| maker | `str = ""` | `String(200), nullable` | `str \| None = None` | `r.maker` | MATCH |
| product_type | `str = ""` | `String(10), nullable` | `str \| None = None` | `r.product_type` | MATCH |
| category1 | `str = ""` | `String(100), nullable` | `str \| None = None` | `r.category1` | MATCH |
| category2 | `str = ""` | `String(100), nullable` | `str \| None = None` | `r.category2` | MATCH |
| category3 | `str = ""` | `String(100), nullable` | `str \| None = None` | `r.category3` | MATCH |
| category4 | `str = ""` | `String(100), nullable` | `str \| None = None` | `r.category4` | MATCH |

Note on type differences: The dataclass uses `str = ""` (non-nullable with empty default), while the model and schema use nullable types (`str | None`). This is intentional -- the Naver API always returns strings (empty or populated), but database storage allows NULL for rows created before migration. The schema reflects the database reality. This is an acceptable design decision.

---

## 4. Match Rate Summary

```
+-----------------------------------------------+
|  Overall Match Rate: 100%                      |
+-----------------------------------------------+
|  Item 1  - base.py RankingItem:      8/8   OK |
|  Item 2  - naver.py extraction:      8/8   OK |
|  Item 3  - keyword_ranking model:    8/8   OK |
|  Item 4  - main.py ALTER TABLE:      8/8   OK |
|  Item 5  - manager.py mapping:       8/8   OK |
|  Item 6  - search_keyword schema:    9/9   OK |
|  Item 7  - product.py Competitor:    3/3   OK |
|  Item 8  - product_service.py:      11/11  OK |
|  Item 9  - categories.py new file:   7/7   OK |
|  Item 10 - router.py registration:   2/2   OK |
|  Item 11 - store import files:       8/8   OK |
|  Item 12 - CLAUDE.md changelog:      8/8   OK |
+-----------------------------------------------+
|  Total: 88/88 verification points             |
|  Matched: 88  |  Missing: 0  |  Changed: 0   |
+-----------------------------------------------+
```

---

## 5. Overall Scores

| Category | Score | Status |
|----------|:-----:|:------:|
| Design Match | 100% | PASS |
| Architecture Compliance | 100% | PASS |
| Convention Compliance | 100% | PASS |
| **Overall** | **100%** | **PASS** |

---

## 6. Differences Found

### Missing Features (Design O, Implementation X)

None.

### Added Features (Design X, Implementation O)

None.

### Changed Features (Design != Implementation)

None.

---

## 7. Observations (Non-blocking)

### 7.1 Defensive Coding Pattern

The `hprice` extraction in `naver.py` line 64 uses `int(item.get("hprice", 0) or 0)`. The `or 0` clause handles the case where the Naver API returns an empty string `""` for hprice (which is falsy in Python). This is correctly implemented per design spec.

### 7.2 product_type Casting

In `naver.py` line 67, `product_type` uses `str(item.get("productType", ""))` with explicit `str()` cast. The Naver API returns productType as an integer (1, 2, 3, etc.), so this cast ensures consistent string storage matching the `String(10)` column type.

### 7.3 CompetitorSummary Scope

The design specified adding hprice, brand, maker to CompetitorSummary. The implementation correctly limits these to 3 fields (not all 8) since category/product_type data is less useful in the competitor summary context. Full 8 fields are available in the per-keyword rankings response.

---

## 8. Recommended Actions

### Immediate Actions

None required. All 88 verification points match the design spec.

### Documentation Update Needed

None. CLAUDE.md has already been updated with the complete changelog entry.

---

## 9. Next Steps

- [x] All planned changes implemented
- [x] CLAUDE.md updated
- [ ] Frontend integration (Codex responsibility): consume new fields in UI
- [ ] Verify category tree API returns correct data after next crawl cycle

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-02-22 | Initial analysis -- 100% match | gap-detector |
