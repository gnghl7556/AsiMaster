# cost-preset-bulk Analysis Report

> **Analysis Type**: Gap Analysis (Design vs Implementation)
>
> **Project**: AsiMaster
> **Analyst**: Claude Code (gap-detector)
> **Date**: 2026-02-26
> **Design Doc**: [cost-preset-bulk.design.md](../02-design/features/cost-preset-bulk.design.md)

---

## 1. Analysis Overview

### 1.1 Analysis Purpose

Verify that all FR-01 through FR-08 requirements defined in the design document for the "비용 프리셋 복수 적용" (Cost Preset Bulk Apply) feature have been correctly implemented. This is the Check phase of the PDCA cycle.

### 1.2 Analysis Scope

- **Design Document**: `docs/02-design/features/cost-preset-bulk.design.md`
- **Implementation Files**:
  - `backend/app/models/cost.py`
  - `backend/app/models/product.py`
  - `backend/app/schemas/cost.py`
  - `backend/app/schemas/product.py`
  - `backend/app/api/costs.py`
  - `backend/app/main.py`
  - `CLAUDE.md`
- **Analysis Date**: 2026-02-26

---

## 2. Gap Analysis (Design vs Implementation)

### 2.1 FR-01: CostPreset 모델 updated_at 추가

**Design spec** (`models/cost.py`):
```python
updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())
```

**Actual implementation** (`backend/app/models/cost.py`, lines 33-35):
```python
updated_at: Mapped[datetime | None] = mapped_column(
    DateTime, server_default=func.now(), onupdate=func.now()
)
```

| Check Item | Design | Implementation | Status |
|-----------|--------|----------------|--------|
| Field name | `updated_at` | `updated_at` | ✅ Match |
| Type annotation | `Mapped[datetime]` | `Mapped[datetime | None]` | ⚠️ Minor deviation |
| server_default | `func.now()` | `func.now()` | ✅ Match |
| onupdate | `func.now()` | `func.now()` | ✅ Match |
| SQLAlchemy type | (implicit) | `DateTime` explicit | ✅ Acceptable |

**Assessment**: Functionally equivalent. The implementation uses `datetime | None` (nullable) instead of `datetime` (non-nullable). This is a minor improvement — since `updated_at` is populated by `server_default`, NULL can only appear for rows inserted before the column was added. The nullable type annotation is safer for existing data. **Result: PASS**

---

### 2.2 FR-02: Product 모델 cost_preset_id FK 추가

**Design spec** (`models/product.py`):
```python
cost_preset_id: Mapped[int | None] = mapped_column(
    Integer,
    ForeignKey("cost_presets.id", ondelete="SET NULL"),
)
```

**Actual implementation** (`backend/app/models/product.py`, lines 40-43):
```python
# 비용 프리셋 참조
cost_preset_id: Mapped[int | None] = mapped_column(
    Integer,
    ForeignKey("cost_presets.id", ondelete="SET NULL"),
)
```

| Check Item | Design | Implementation | Status |
|-----------|--------|----------------|--------|
| Field name | `cost_preset_id` | `cost_preset_id` | ✅ Match |
| Type | `Mapped[int | None]` | `Mapped[int | None]` | ✅ Match |
| ForeignKey target | `cost_presets.id` | `cost_presets.id` | ✅ Match |
| ondelete | `SET NULL` | `SET NULL` | ✅ Match |
| nullable | True | True (via `int | None`) | ✅ Match |

**Assessment**: Exact match with design specification. **Result: PASS**

---

### 2.3 FR-03: 프리셋 수정 API (PUT /cost-presets/{preset_id})

**Design spec** (`api/costs.py`):
```
PUT /cost-presets/{preset_id}
Response: CostPresetResponse
- Partial update: name only, items only, or both
- 404 if preset not found
- flush + refresh before return
```

**Actual implementation** (`backend/app/api/costs.py`, lines 77-90):

| Check Item | Design | Implementation | Status |
|-----------|--------|----------------|--------|
| Endpoint URL | `/cost-presets/{preset_id}` | `/cost-presets/{preset_id}` | ✅ Match |
| HTTP method | PUT | PUT | ✅ Match |
| Response model | `CostPresetResponse` | `CostPresetResponse` | ✅ Match |
| 404 on not found | Yes | Yes (HTTPException 404) | ✅ Match |
| Partial update: name | Conditional | `if data.name is not None` | ✅ Match |
| Partial update: items | Conditional | `if data.items is not None` | ✅ Match |
| items serialization | `item.model_dump()` | `item.model_dump()` | ✅ Match |
| `db.flush()` call | Yes | Yes | ✅ Match |
| `db.refresh(preset)` | Yes | Yes | ✅ Match |
| Status code | 200 (default) | 200 (default) | ✅ Match |

**Assessment**: Exact match with design specification. **Result: PASS**

---

### 2.4 FR-04: 프리셋 복수 적용 API (POST /cost-presets/{preset_id}/apply)

**Design spec** (`api/costs.py`):
```
POST /cost-presets/{preset_id}/apply
- 404 if preset not found
- 400 if no applicable products found
- Filter products by user_id match
- Bulk delete existing cost_items
- Create new CostItems from preset.items
- Set product.cost_preset_id = preset_id
- Return: applied, skipped, skipped_ids
```

**Actual implementation** (`backend/app/api/costs.py`, lines 93-139):

| Check Item | Design | Implementation | Status |
|-----------|--------|----------------|--------|
| Endpoint URL | `/cost-presets/{preset_id}/apply` | `/cost-presets/{preset_id}/apply` | ✅ Match |
| HTTP method | POST | POST | ✅ Match |
| Response model | `CostPresetApplyResponse` | `CostPresetApplyResponse` | ✅ Match |
| 404 on preset not found | Yes | Yes | ✅ Match |
| 400 on empty product list | Yes | Yes | ✅ Match |
| user_id ownership check | `Product.user_id == preset.user_id` | `Product.user_id == preset.user_id` | ✅ Match |
| Bulk delete cost_items | `delete(CostItem).where(CostItem.product_id.in_(found_ids))` | Same | ✅ Match |
| Create new CostItems | Per product, per item_data | Per product, per item_data | ✅ Match |
| CostItem fields | name, type, value, sort_order | name, type, value, sort_order | ✅ Match |
| `product.cost_preset_id = preset_id` | Yes | Yes | ✅ Match |
| `db.flush()` | Yes | Yes | ✅ Match |
| skipped_ids calculation | Products not in found_ids | Same logic | ✅ Match |
| Response: applied | `len(products)` | `len(products)` | ✅ Match |
| Response: skipped | `len(skipped_ids)` | `len(skipped_ids)` | ✅ Match |
| Response: skipped_ids | List of skipped IDs | Same | ✅ Match |

**Assessment**: Exact match with design specification. All steps match. **Result: PASS**

---

### 2.5 FR-05: 기존 API 연동 수정

#### FR-05-1: PUT /products/{product_id}/costs — 프리셋 연결 해제

**Actual implementation** (`backend/app/api/costs.py`, lines 30-48):

| Check Item | Design | Implementation | Status |
|-----------|--------|----------------|--------|
| `product.cost_preset_id = None` | Added before delete | Line 38, before delete | ✅ Match |
| Existing cost_items deleted | Yes | Yes | ✅ Match |
| New items created | Yes | Yes | ✅ Match |
| flush + refresh | Yes | Yes | ✅ Match |

#### FR-05-2: DELETE /cost-presets/{preset_id} — 참조 상품 SET NULL

**Actual implementation** (`backend/app/api/costs.py`, lines 142-153):

| Check Item | Design | Implementation | Status |
|-----------|--------|----------------|--------|
| 404 on preset not found | Yes | Yes | ✅ Match |
| UPDATE Product SET cost_preset_id=NULL | `update(Product).where(...).values(cost_preset_id=None)` | Same | ✅ Match |
| `await db.delete(preset)` | Yes | Yes | ✅ Match |
| status_code=204 | Yes | Yes | ✅ Match |

**Assessment**: Both sub-requirements fully implemented. **Result: PASS**

---

### 2.6 FR-06: Product 스키마에 cost_preset_id 추가

**Design spec**:
- `ProductResponse.cost_preset_id: int | None = None`
- `ProductDetail.cost_preset_id: int | None = None`
- `ProductListItem.cost_preset_id: int | None = None`
- `CostPresetResponse.updated_at: datetime | None = None`

**Actual implementation** (`backend/app/schemas/product.py`, `backend/app/schemas/cost.py`):

| Check Item | Design | Implementation | Status |
|-----------|--------|----------------|--------|
| `ProductResponse.cost_preset_id` | `int | None = None` | Line 75: `int | None = None` | ✅ Match |
| `ProductDetail.cost_preset_id` | `int | None = None` | Line 179: `int | None = None` | ✅ Match |
| `ProductListItem.cost_preset_id` | `int | None = None` | Line 96: `int | None = None` | ✅ Match |
| `CostPresetResponse.updated_at` | `datetime | None = None` | Line 51: `datetime | None = None` | ✅ Match |
| `CostPresetUpdate` schema | Defined | Lines 30-32: Defined | ✅ Match |
| `CostPresetApplyRequest` schema | Defined | Lines 35-36: Defined | ✅ Match |
| `CostPresetApplyResponse` schema | Defined | Lines 39-42: Defined | ✅ Match |

**`CostPresetApplyRequest` field validation**:
| Check Item | Design | Implementation | Status |
|-----------|--------|----------------|--------|
| `product_ids` min_length | 1 | 1 | ✅ Match |
| `product_ids` max_length | 100 | 100 | ✅ Match |

**Assessment**: All schemas match design specification exactly. **Result: PASS**

---

### 2.7 FR-07: ALTER TABLE 마이그레이션

**Design spec** (`main.py`):
```python
alter_statements additions:
("cost_presets", "updated_at", "TIMESTAMP", "NOW()"),
("products", "cost_preset_id", "INTEGER", None),
```
Plus FK constraint via `fk_statements` for PostgreSQL.

**Actual implementation** (`backend/app/main.py`, lines 55-57, 76-93):

| Check Item | Design | Implementation | Status |
|-----------|--------|----------------|--------|
| `("cost_presets", "updated_at", "TIMESTAMP", "NOW()")` | Required | Line 57: Present | ✅ Match |
| `("products", "cost_preset_id", "INTEGER", None)` | Required | Line 56: Present | ✅ Match |
| FK constraint block | `fk_statements = [...]` | Lines 77-88: Present | ✅ Match |
| FK constraint SQL | `ADD CONSTRAINT fk_products_cost_preset_id FOREIGN KEY ... ON DELETE SET NULL` | Exact match (via DO $$ BEGIN / IF NOT EXISTS block) | ✅ Match |
| PostgreSQL-only FK | Yes (not for SQLite) | `if not is_sqlite:` guard | ✅ Match |
| FK exception handling | Design says `ADD CONSTRAINT IF NOT EXISTS` | Implemented via `DO $$ ... IF NOT EXISTS` pattern + try/except | ✅ Match |

**Note**: The design shows `ADD CONSTRAINT IF NOT EXISTS` syntax (PostgreSQL 9.0+ style), while the implementation uses the safer `DO $$ BEGIN ... IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname=...) THEN ALTER TABLE ... END IF; END $$` pattern. The implementation is functionally equivalent and more robust.

**Assessment**: Both ALTER TABLE entries and the FK constraint block are implemented. The FK implementation pattern is slightly more verbose but achieves the same idempotency goal. **Result: PASS**

---

### 2.8 FR-08: CLAUDE.md API 명세 업데이트

**Design spec**: Document the following in CLAUDE.md:
- `PUT /cost-presets/{preset_id}` — 프리셋 수정
- `POST /cost-presets/{preset_id}/apply` — 복수 상품에 적용
- `PUT /products/{product_id}/costs` change (cost_preset_id 해제)
- `DELETE /cost-presets/{preset_id}` change (SET NULL 처리)
- Product schema changes (cost_preset_id in Response/Detail/ListItem)

**Actual CLAUDE.md** (lines 361-387, section "2026-02-26: 비용 프리셋 복수 적용"):

| Check Item | Design | Implementation | Status |
|-----------|--------|----------------|--------|
| Section date header | Required | `### 2026-02-26: 비용 프리셋 복수 적용` | ✅ Present |
| `Product.cost_preset_id` FK documented | Required | Lines 363-364: Documented | ✅ Match |
| `CostPreset.updated_at` documented | Required | Lines 366-367: Documented | ✅ Match |
| `PUT /cost-presets/{preset_id}` | Required | Lines 370-373: Full Request/Response spec | ✅ Match |
| `POST /cost-presets/{preset_id}/apply` | Required | Lines 375-379: Full Request/Response spec | ✅ Match |
| `PUT /products/{product_id}/costs` change | Required | Line 382: Documented | ✅ Match |
| `DELETE /cost-presets/{preset_id}` change | Required | Line 383: Documented | ✅ Match |
| `CostPresetResponse.updated_at` schema change | Required | Line 386: Documented | ✅ Match |
| Product schema changes (3 schemas) | Required | Line 387: Documented | ✅ Match |
| Core API endpoint list updated | Expected | Lines 88-89: `PUT /cost-presets/{id}`, `POST /cost-presets/{id}/apply` | ✅ Present |
| Feature list updated | Expected | Line 118: Feature #19 added | ✅ Present |

**Assessment**: All required API change history items are documented in CLAUDE.md. **Result: PASS**

---

### 2.9 Match Rate Summary

```
+-----------------------------------------------+
|  Overall Match Rate: 100%                      |
+-----------------------------------------------+
|  FR-01 (CostPreset.updated_at):  ✅ PASS       |
|  FR-02 (Product.cost_preset_id): ✅ PASS       |
|  FR-03 (PUT preset):             ✅ PASS       |
|  FR-04 (POST apply):             ✅ PASS       |
|  FR-05-1 (PUT costs unlink):     ✅ PASS       |
|  FR-05-2 (DELETE SET NULL):      ✅ PASS       |
|  FR-06 (Schema updates):         ✅ PASS       |
|  FR-07 (ALTER TABLE migration):  ✅ PASS       |
|  FR-08 (CLAUDE.md update):       ✅ PASS       |
+-----------------------------------------------+
|  Total: 9/9 requirements met (8 FR items,      |
|         FR-05 counted as 2 sub-requirements)   |
+-----------------------------------------------+
```

---

## 3. Detailed Comparison: Design vs Implementation

### 3.1 API Endpoints

| Design Endpoint | Implementation | HTTP Method | Status |
|----------------|---------------|-------------|--------|
| `PUT /cost-presets/{preset_id}` | `/cost-presets/{preset_id}` | PUT | ✅ Match |
| `POST /cost-presets/{preset_id}/apply` | `/cost-presets/{preset_id}/apply` | POST | ✅ Match |
| `PUT /products/{product_id}/costs` (modified) | `/products/{product_id}/costs` | PUT | ✅ Match |
| `DELETE /cost-presets/{preset_id}` (modified) | `/cost-presets/{preset_id}` | DELETE | ✅ Match |

### 3.2 Data Model Fields

| Field | Table | Design Type | Impl Type | Default | ondelete | Status |
|-------|-------|------------|-----------|---------|----------|--------|
| `updated_at` | `cost_presets` | `datetime` (non-null) | `datetime \| None` | `func.now()` | - | ✅ Acceptable |
| `cost_preset_id` | `products` | `int \| None` | `int \| None` | NULL | SET NULL | ✅ Match |

### 3.3 Schema Definitions

| Schema | Field | Design | Implementation | Status |
|--------|-------|--------|---------------|--------|
| `CostPresetUpdate` | `name` | `str \| None`, min=1, max=100 | `str \| None`, min=1, max=100 | ✅ Match |
| `CostPresetUpdate` | `items` | `list[CostItemCreate] \| None` | `list[CostItemCreate] \| None` | ✅ Match |
| `CostPresetApplyRequest` | `product_ids` | `list[int]`, min=1, max=100 | `list[int]`, min=1, max=100 | ✅ Match |
| `CostPresetApplyResponse` | `applied` | `int` | `int` | ✅ Match |
| `CostPresetApplyResponse` | `skipped` | `int` | `int` | ✅ Match |
| `CostPresetApplyResponse` | `skipped_ids` | `list[int] = []` | `list[int] = []` | ✅ Match |
| `CostPresetResponse` | `updated_at` | `datetime \| None = None` | `datetime \| None = None` | ✅ Match |
| `ProductResponse` | `cost_preset_id` | `int \| None = None` | `int \| None = None` | ✅ Match |
| `ProductDetail` | `cost_preset_id` | `int \| None = None` | `int \| None = None` | ✅ Match |
| `ProductListItem` | `cost_preset_id` | `int \| None = None` | `int \| None = None` | ✅ Match |

### 3.4 Business Logic

| Logic Item | Design | Implementation | Status |
|-----------|--------|---------------|--------|
| apply: user_id ownership check | `Product.user_id == preset.user_id` | Same | ✅ Match |
| apply: bulk delete then create | delete → add loop | delete → add loop | ✅ Match |
| apply: set cost_preset_id | `product.cost_preset_id = preset_id` | Same | ✅ Match |
| apply: skipped products | `product_ids not in found_ids` | Same | ✅ Match |
| save costs: unlink preset | `product.cost_preset_id = None` | Same | ✅ Match |
| delete preset: SET NULL | `update(Product).values(cost_preset_id=None)` | Same | ✅ Match |

---

## 4. Differences Found

### Missing Features (Design O, Implementation X)

None detected.

### Added Features (Design X, Implementation O)

None detected.

### Changed Features (Design != Implementation)

| Item | Design | Implementation | Impact | Verdict |
|------|--------|---------------|--------|---------|
| `CostPreset.updated_at` type | `Mapped[datetime]` (non-null) | `Mapped[datetime \| None]` (nullable) | Low — safer for existing data | Acceptable improvement |
| FK constraint SQL syntax | `ADD CONSTRAINT IF NOT EXISTS ... FK ...` (one-liner) | `DO $$ BEGIN IF NOT EXISTS (pg_constraint check) THEN ALTER TABLE ... END IF; END $$` | None — same result | Acceptable, more robust |

Both deviations are implementation improvements over the design, not regressions.

---

## 5. Code Quality Analysis

### 5.1 API Handler Quality

| File | Function | Lines | Observation |
|------|----------|-------|-------------|
| `api/costs.py` | `apply_cost_preset` | 93-139 (46 lines) | Within acceptable length |
| `api/costs.py` | `update_cost_preset` | 77-90 (13 lines) | Concise |
| `api/costs.py` | `delete_cost_preset` | 142-153 (11 lines) | Concise |
| `api/costs.py` | `save_cost_items` | 30-48 (18 lines) | Concise |

### 5.2 Security Observations

| Item | Location | Assessment |
|------|----------|-----------|
| User ownership enforcement | `apply_cost_preset`: `Product.user_id == preset.user_id` | ✅ Correct — prevents cross-user preset application |
| No user_id parameter exposure | Ownership derived from preset's user_id | ✅ No direct user_id injection possible |
| Input validation | `CostPresetApplyRequest.product_ids` max_length=100 | ✅ Prevents oversized payload |
| Preset existence check | 404 before any data mutation | ✅ Correct ordering |

### 5.3 Transaction Safety

| Item | Assessment |
|------|-----------|
| `delete + add` within same session | ✅ Atomic via single `await db.flush()` |
| `update(Product)` before `db.delete(preset)` | ✅ Correct — SET NULL before delete prevents FK violation |
| No explicit `commit()` in handlers | ✅ Consistent with project pattern (auto-commit at session close) |

---

## 6. Overall Scores

| Category | Score | Status |
|----------|:-----:|:------:|
| Design Match (FR-01 to FR-08) | 100% | ✅ |
| API Implementation | 100% | ✅ |
| Data Model | 100% | ✅ |
| Schema Definitions | 100% | ✅ |
| Business Logic | 100% | ✅ |
| Migration Script | 100% | ✅ |
| Documentation (CLAUDE.md) | 100% | ✅ |
| **Overall** | **100%** | ✅ |

---

## 7. Recommended Actions

### Immediate Actions

None required. All requirements are fully implemented.

### Optional Improvements (Backlog)

| Priority | Item | Location | Notes |
|----------|------|----------|-------|
| Low | Add `cost_preset_id` index | `models/product.py` | Would speed up `apply_cost_preset` query if user has many products. Not required for current scale. |
| Low | Return `updated_at` in `apply_cost_preset` response | `schemas/cost.py` | `CostPresetApplyResponse` could optionally include the preset's `updated_at` for client cache invalidation. Not required by design. |

---

## 8. Conclusion

The "비용 프리셋 복수 적용" feature achieves a **100% match rate** against all FR-01 through FR-08 requirements. Every design specification has been implemented correctly:

- All model fields added with correct types and constraints
- All four API endpoints (PUT preset, POST apply, PUT costs unlink, DELETE SET NULL) implemented with exact business logic
- All schema classes match design specifications
- Migration entries are present in the correct location in `main.py`
- CLAUDE.md documents all API changes including request/response formats

The two minor implementation deviations from the design (`updated_at` nullable type, FK constraint via `DO $$ BEGIN` block) are both improvements in correctness and robustness, not regressions.

---

## 9. Next Steps

- [x] Gap analysis complete — 100% match rate achieved
- [ ] Write completion report: `docs/04-report/features/cost-preset-bulk.report.md`
- [ ] Run `/pdca report cost-preset-bulk` to generate the Act phase report

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-02-26 | Initial gap analysis | Claude Code (gap-detector) |
