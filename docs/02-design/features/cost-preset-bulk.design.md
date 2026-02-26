# Design: 비용 프리셋 복수 적용

> Plan 문서: `docs/01-plan/features/cost-preset-bulk.plan.md`

## 요구사항 정리

| ID | 요구사항 | 우선순위 |
|----|----------|----------|
| FR-01 | CostPreset 모델에 updated_at 추가 | 필수 |
| FR-02 | Product 모델에 cost_preset_id FK 추가 | 필수 |
| FR-03 | 프리셋 수정 API (PUT) | 필수 |
| FR-04 | 프리셋 복수 적용 API (POST apply) | 필수 |
| FR-05 | 기존 API 연동 수정 (PUT costs → preset 해제, DELETE preset → SET NULL) | 필수 |
| FR-06 | Product 스키마에 cost_preset_id 추가 | 필수 |
| FR-07 | main.py ALTER TABLE 마이그레이션 | 필수 |
| FR-08 | CLAUDE.md API 명세 업데이트 | 필수 |

## 상세 설계

### FR-01: CostPreset 모델에 updated_at 추가

**파일**: `backend/app/models/cost.py`

```python
class CostPreset(Base):
    __tablename__ = "cost_presets"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    items: Mapped[dict] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())  # 신규

    user: Mapped["User"] = relationship(back_populates="cost_presets")
```

---

### FR-02: Product 모델에 cost_preset_id FK 추가

**파일**: `backend/app/models/product.py`

```python
# 기존 필드 아래에 추가
cost_preset_id: Mapped[int | None] = mapped_column(
    Integer,
    ForeignKey("cost_presets.id", ondelete="SET NULL"),
)
```

**설계 결정**:
- `ondelete="SET NULL"`: 프리셋 삭제 시 상품의 cost_items는 유지, 참조만 해제
- nullable: 프리셋 미적용 상품 = NULL (수동 비용 설정)
- FK 제약: 유효한 프리셋만 참조 가능

---

### FR-03: 프리셋 수정 API

**파일**: `backend/app/api/costs.py`

**엔드포인트**: `PUT /cost-presets/{preset_id}`

```python
@router.put("/cost-presets/{preset_id}", response_model=CostPresetResponse)
async def update_cost_preset(
    preset_id: int,
    data: CostPresetUpdate,
    db: AsyncSession = Depends(get_db),
):
    preset = await db.get(CostPreset, preset_id)
    if not preset:
        raise HTTPException(404, "프리셋을 찾을 수 없습니다.")

    if data.name is not None:
        preset.name = data.name
    if data.items is not None:
        preset.items = [item.model_dump() for item in data.items]

    await db.flush()
    await db.refresh(preset)
    return preset
```

**스키마** (`schemas/cost.py`):

```python
class CostPresetUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    items: list[CostItemCreate] | None = None
```

> **부분 수정 지원**: name만 또는 items만 변경 가능. 둘 다 None이면 아무것도 변경하지 않음.

---

### FR-04: 프리셋 복수 적용 API

**파일**: `backend/app/api/costs.py`

**엔드포인트**: `POST /cost-presets/{preset_id}/apply`

```python
@router.post("/cost-presets/{preset_id}/apply", response_model=CostPresetApplyResponse)
async def apply_cost_preset(
    preset_id: int,
    data: CostPresetApplyRequest,
    db: AsyncSession = Depends(get_db),
):
    # 1. 프리셋 조회
    preset = await db.get(CostPreset, preset_id)
    if not preset:
        raise HTTPException(404, "프리셋을 찾을 수 없습니다.")

    # 2. 대상 상품 조회 (user_id 소속 확인)
    result = await db.execute(
        select(Product).where(
            Product.id.in_(data.product_ids),
            Product.user_id == preset.user_id,
        )
    )
    products = result.scalars().all()

    if not products:
        raise HTTPException(400, "적용 가능한 상품이 없습니다.")

    found_ids = {p.id for p in products}

    # 3. 기존 cost_items 일괄 삭제
    await db.execute(
        delete(CostItem).where(CostItem.product_id.in_(found_ids))
    )

    # 4. 프리셋 items로 새 CostItem 행 생성
    for product in products:
        for item_data in preset.items:
            db.add(CostItem(
                product_id=product.id,
                name=item_data["name"],
                type=item_data["type"],
                value=item_data["value"],
                sort_order=item_data.get("sort_order", 0),
            ))
        product.cost_preset_id = preset_id

    await db.flush()

    # 5. 결과 반환
    skipped_ids = [pid for pid in data.product_ids if pid not in found_ids]
    return CostPresetApplyResponse(
        applied=len(products),
        skipped=len(skipped_ids),
        skipped_ids=skipped_ids,
    )
```

**스키마** (`schemas/cost.py`):

```python
class CostPresetApplyRequest(BaseModel):
    product_ids: list[int] = Field(..., min_length=1, max_length=100)

class CostPresetApplyResponse(BaseModel):
    applied: int
    skipped: int
    skipped_ids: list[int] = []
```

**동작 정리**:
1. 프리셋의 `user_id` 소속 상품만 적용 (타 유저 상품 방지)
2. 기존 cost_items를 **일괄 삭제 후 재생성** (기존 PUT costs와 동일 패턴)
3. `cost_preset_id` 갱신 → 어떤 프리셋이 적용되었는지 추적
4. 존재하지 않거나 타 유저 소속 상품은 스킵 처리

---

### FR-05: 기존 API 연동 수정

#### FR-05-1: PUT /products/{product_id}/costs — 프리셋 연결 해제

**파일**: `backend/app/api/costs.py`

```python
@router.put("/products/{product_id}/costs", response_model=list[CostItemResponse])
async def save_cost_items(
    product_id: int, items: list[CostItemCreate], db: AsyncSession = Depends(get_db)
):
    product = await db.get(Product, product_id)
    if not product:
        raise HTTPException(404, "상품을 찾을 수 없습니다.")

    # 수동 수정 시 프리셋 연결 해제
    product.cost_preset_id = None                 # 추가

    await db.execute(delete(CostItem).where(CostItem.product_id == product_id))
    new_items = []
    for item in items:
        cost_item = CostItem(product_id=product_id, **item.model_dump())
        db.add(cost_item)
        new_items.append(cost_item)
    await db.flush()
    for item in new_items:
        await db.refresh(item)
    return new_items
```

#### FR-05-2: DELETE /cost-presets/{preset_id} — 참조 상품 SET NULL

**파일**: `backend/app/api/costs.py`

```python
@router.delete("/cost-presets/{preset_id}", status_code=204)
async def delete_cost_preset(preset_id: int, db: AsyncSession = Depends(get_db)):
    preset = await db.get(CostPreset, preset_id)
    if not preset:
        raise HTTPException(404, "프리셋을 찾을 수 없습니다.")

    # FK ondelete="SET NULL"이 DB 레벨에서 처리하지만,
    # ORM 세션 내 일관성을 위해 명시적으로 처리
    await db.execute(
        update(Product)
        .where(Product.cost_preset_id == preset_id)
        .values(cost_preset_id=None)
    )

    await db.delete(preset)
```

---

### FR-06: Product 스키마에 cost_preset_id 추가

**파일**: `backend/app/schemas/product.py`

```python
class ProductResponse(BaseModel):
    # ... 기존 필드 ...
    cost_preset_id: int | None = None
    model_config = {"from_attributes": True}

class ProductDetail(BaseModel):
    # ... 기존 필드 ...
    cost_preset_id: int | None = None

class ProductListItem(BaseModel):
    # ... 기존 필드 ...
    cost_preset_id: int | None = None
```

**CostPresetResponse 확장**:

```python
class CostPresetResponse(BaseModel):
    id: int
    user_id: int
    name: str
    items: list[dict]
    created_at: datetime
    updated_at: datetime | None = None    # 추가

    model_config = {"from_attributes": True}
```

---

### FR-07: ALTER TABLE 마이그레이션

**파일**: `backend/app/main.py`

`alter_statements`에 추가:

```python
# 비용 프리셋 복수 적용
("cost_presets", "updated_at", "TIMESTAMP", "NOW()"),
("products", "cost_preset_id", "INTEGER", None),
```

> `cost_preset_id`의 FK 제약은 `create_all`에서 모델 정의로 자동 생성.
> ALTER TABLE에서는 컬럼만 추가하고, FK는 별도 처리 불필요 (이미 create_all로 테이블이 존재하므로 ADD COLUMN만 하면 됨).

**FK 제약 추가** (PostgreSQL, create_all 이후 ALTER TABLE 시):

```python
# alter_statements 이후 별도 처리
fk_statements = [
    """ALTER TABLE products
       ADD CONSTRAINT IF NOT EXISTS fk_products_cost_preset_id
       FOREIGN KEY (cost_preset_id) REFERENCES cost_presets(id)
       ON DELETE SET NULL""",
]
```

> SQLite에서는 FK 제약 ALTER 불가 → PostgreSQL에서만 실행, SQLite는 스킵.

---

### FR-08: CLAUDE.md API 명세 업데이트

신규/변경 API:
- `PUT /cost-presets/{preset_id}` — 프리셋 수정
- `POST /cost-presets/{preset_id}/apply` — 복수 상품에 적용
- `PUT /products/{product_id}/costs` — 수동 수정 시 cost_preset_id 해제
- `DELETE /cost-presets/{preset_id}` — 참조 상품 SET NULL 처리

Product 스키마 변경:
- `cost_preset_id` 필드 추가 (Response, Detail, ListItem)

---

## 구현 순서

| 순서 | 파일 | 변경 내용 | 의존성 |
|------|------|----------|--------|
| 1 | `models/cost.py` | CostPreset에 updated_at 추가 | 없음 |
| 2 | `models/product.py` | cost_preset_id FK 추가 | 1 |
| 3 | `main.py` | ALTER TABLE + FK 마이그레이션 | 없음 |
| 4 | `schemas/cost.py` | CostPresetUpdate, ApplyRequest/Response, Response 확장 | 없음 |
| 5 | `schemas/product.py` | cost_preset_id 필드 추가 | 없음 |
| 6 | `api/costs.py` | PUT preset, POST apply, PUT costs 수정, DELETE 수정 | 1, 2, 4 |
| 7 | `CLAUDE.md` | API 명세 업데이트 | 전체 완료 후 |

## 영향 분석

### 영향 받는 기능
- 프리셋 CRUD → 수정 API 추가, 삭제 시 SET NULL 처리
- 상품 비용 수정 → cost_preset_id 자동 해제
- 상품 조회 API → cost_preset_id 응답에 포함

### 영향 없는 기능
- 크롤링 엔진 (비용과 무관)
- 마진 계산 로직 (cost_items 기반, 변경 없음)
- 블랙리스트/알림
- 대시보드

## 프론트엔드 연동 명세 (Codex용)

### 타입 변경
```typescript
// types/index.ts
interface Product {
  // ... 기존 필드 ...
  cost_preset_id?: number | null;
}

interface CostPreset {
  id: number;
  user_id: number;
  name: string;
  items: CostItemInput[];
  created_at: string;
  updated_at?: string | null;
}
```

### 새 API 호출
```typescript
// 프리셋 수정
PUT /cost-presets/{preset_id}
Body: { name?: string, items?: CostItemInput[] }
Response: CostPreset

// 프리셋 복수 적용
POST /cost-presets/{preset_id}/apply
Body: { product_ids: number[] }
Response: { applied: number, skipped: number, skipped_ids: number[] }
```

### UI 시나리오

#### 시나리오 1: 상품 목록 → 프리셋 적용
1. 상품 목록에서 체크박스로 복수 선택
2. "비용 프리셋 적용" 버튼 클릭
3. 프리셋 선택 모달 표시 (GET /users/{id}/cost-presets)
4. 프리셋 선택 후 "적용" → POST /cost-presets/{id}/apply
5. 결과 토스트: "3개 상품에 프리셋 적용 완료"

#### 시나리오 2: 프리셋 관리 → 상품 적용
1. 설정 > 비용 프리셋 관리 페이지
2. 프리셋 선택 → "상품에 적용" 버튼
3. 상품 선택 모달 표시 (GET /users/{id}/products)
4. 상품 체크 후 "적용" → POST /cost-presets/{id}/apply

#### 시나리오 3: 프리셋 수정
1. 프리셋 목록에서 편집 버튼
2. 이름/항목 수정 폼
3. 저장 → PUT /cost-presets/{id} (기존 삭제+생성 방식 제거)
