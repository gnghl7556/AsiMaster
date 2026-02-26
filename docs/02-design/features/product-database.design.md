# Design: 상품 DB화 (모델명 기반 제품 속성 구조화)

> Plan 문서: `docs/01-plan/features/product-database.plan.md`

## 요구사항 정리

| ID | 요구사항 | 우선순위 |
|----|----------|----------|
| FR-01 | Product 모델에 제품 속성 필드 7개 추가 | 필수 |
| FR-02 | Product 스키마(Create/Update/Response/Detail/ListItem)에 필드 추가 | 필수 |
| FR-03 | 스토어 import 시 brand, maker 자동 저장 | 필수 |
| FR-04 | main.py ALTER TABLE 마이그레이션 | 필수 |
| FR-05 | CLAUDE.md API 명세 업데이트 | 필수 |

## 상세 설계

### FR-01: Product 모델 확장

**파일**: `backend/app/models/product.py`

```python
# 기존 price_filter_max_pct 아래에 추가
brand: Mapped[str | None] = mapped_column(String(100))
maker: Mapped[str | None] = mapped_column(String(100))
series: Mapped[str | None] = mapped_column(String(100))
capacity: Mapped[str | None] = mapped_column(String(50))
color: Mapped[str | None] = mapped_column(String(50))
material: Mapped[str | None] = mapped_column(String(50))
product_attributes: Mapped[dict | None] = mapped_column(JSON)
```

**필드 용도**:
| 필드 | 타입 | 용도 | 예시 |
|------|------|------|------|
| `brand` | VARCHAR(100) | 브랜드명 | "삼성", "나이키", "애플" |
| `maker` | VARCHAR(100) | 제조사명 (브랜드와 다를 수 있음) | "삼성전자", "폭스콘" |
| `series` | VARCHAR(100) | 시리즈/라인명 | "갤럭시 S25", "에어맥스 90" |
| `capacity` | VARCHAR(50) | 용량/규격/수량 | "1TB", "500ml", "100매" |
| `color` | VARCHAR(50) | 색상 | "블랙", "화이트", "네이비" |
| `material` | VARCHAR(50) | 소재 | "스테인리스", "가죽", "면" |
| `product_attributes` | JSON | 추가 비정형 속성 (key-value) | `{"사이즈": "XL", "등급": "1등급"}` |

**설계 근거**:
- 자주 쓰는 6개 속성은 정규 컬럼 → SQL WHERE/ORDER BY로 검색·필터 가능
- 제품마다 다른 비정형 속성은 `product_attributes` JSON → 유연성 확보
- 모든 필드 nullable → 기존 데이터 하위 호환, 점진적 입력 가능

---

### FR-02: Pydantic 스키마 변경

**파일**: `backend/app/schemas/product.py`

#### ProductCreate 변경

```python
class ProductCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    category: str | None = None
    cost_price: int = Field(..., ge=0)
    selling_price: int = Field(..., ge=0)
    image_url: str | None = None
    naver_product_id: str | None = Field(None, max_length=50)
    model_code: str | None = Field(None, max_length=100)
    spec_keywords: list[str] | None = None
    price_filter_min_pct: int | None = Field(None, ge=0, le=100)
    price_filter_max_pct: int | None = Field(None, ge=100)
    # 제품 속성 필드 (신규)
    brand: str | None = Field(None, max_length=100)
    maker: str | None = Field(None, max_length=100)
    series: str | None = Field(None, max_length=100)
    capacity: str | None = Field(None, max_length=50)
    color: str | None = Field(None, max_length=50)
    material: str | None = Field(None, max_length=50)
    product_attributes: dict | None = None
```

#### ProductUpdate 변경

```python
class ProductUpdate(BaseModel):
    # ... 기존 필드 유지 ...
    # 제품 속성 필드 (신규)
    brand: str | None = Field(None, max_length=100)
    maker: str | None = Field(None, max_length=100)
    series: str | None = Field(None, max_length=100)
    capacity: str | None = Field(None, max_length=50)
    color: str | None = Field(None, max_length=50)
    material: str | None = Field(None, max_length=50)
    product_attributes: dict | None = None
```

#### ProductResponse 변경

```python
class ProductResponse(BaseModel):
    # ... 기존 필드 유지 ...
    # 제품 속성 필드 (신규)
    brand: str | None = None
    maker: str | None = None
    series: str | None = None
    capacity: str | None = None
    color: str | None = None
    material: str | None = None
    product_attributes: dict | None = None

    model_config = {"from_attributes": True}
```

#### ProductDetail 변경

```python
class ProductDetail(BaseModel):
    # ... 기존 필드 유지 ...
    # 제품 속성 필드 (신규)
    brand: str | None = None
    maker: str | None = None
    series: str | None = None
    capacity: str | None = None
    color: str | None = None
    material: str | None = None
    product_attributes: dict | None = None
```

#### ProductListItem 변경

```python
class ProductListItem(BaseModel):
    # ... 기존 필드 유지 ...
    # 제품 속성 필드 (목록에서도 브랜드/모델코드 표시용)
    model_code: str | None = None
    brand: str | None = None
```

> **ListItem에는 최소한의 필드만 추가**: 목록에서는 brand, model_code만 표시하면 충분.
> 전체 속성은 상세 페이지(ProductDetail)에서 확인.

---

### FR-03: 스토어 import 시 brand, maker 자동 저장

**파일**: `backend/app/api/store_import.py`

현재 `StoreProductItem`에 `brand`, `maker` 필드가 이미 존재하지만, Product 생성 시 매핑하지 않고 있음.

```python
# import_store_products() 내 Product 생성 변경
product = Product(
    user_id=user_id,
    name=item.name,
    selling_price=item.selling_price,
    cost_price=0,
    image_url=item.image_url,
    category=item.category,
    naver_product_id=item.naver_product_id,
    model_code=item.model_code or None,
    spec_keywords=item.spec_keywords if item.spec_keywords else None,
    price_filter_min_pct=item.price_filter_min_pct,
    price_filter_max_pct=item.price_filter_max_pct,
    brand=item.brand or None,          # 추가
    maker=item.maker or None,          # 추가
)
```

**StoreImportItem 스키마 확장** (`schemas/store_import.py`):

```python
class StoreImportItem(BaseModel):
    # ... 기존 필드 유지 ...
    brand: str | None = Field(None, max_length=100)    # 추가
    maker: str | None = Field(None, max_length=100)    # 추가
```

---

### FR-04: ALTER TABLE 마이그레이션

**파일**: `backend/app/main.py`

`apply_schema_changes()` 의 `alter_statements` 리스트에 추가:

```python
# 상품 DB화 - 제품 속성 필드
("products", "brand", "VARCHAR(100)", None),
("products", "maker", "VARCHAR(100)", None),
("products", "series", "VARCHAR(100)", None),
("products", "capacity", "VARCHAR(50)", None),
("products", "color", "VARCHAR(50)", None),
("products", "material", "VARCHAR(50)", None),
("products", "product_attributes", "JSONB", None),
```

> 모든 필드의 기본값이 NULL → 기존 행에 영향 없음

---

### FR-05: CLAUDE.md API 명세 업데이트

**파일**: `CLAUDE.md`

API 변경 이력 섹션에 추가:
- Product 모델 확장 필드 7개 (brand, maker, series, capacity, color, material, product_attributes)
- ProductCreate/Update에 7개 필드 추가
- ProductResponse/Detail에 7개 필드 추가
- ProductListItem에 model_code, brand 추가
- StoreImportItem에 brand, maker 추가
- 스토어 import 시 brand, maker 자동 저장

---

## 구현 순서

| 순서 | 파일 | 변경 내용 | 의존성 |
|------|------|----------|--------|
| 1 | `models/product.py` | 7개 필드 추가 | 없음 |
| 2 | `main.py` | ALTER TABLE 7개 컬럼 추가 | 없음 |
| 3 | `schemas/product.py` | Create/Update/Response/Detail/ListItem 수정 | 1 |
| 4 | `schemas/store_import.py` | StoreImportItem에 brand, maker 추가 | 없음 |
| 5 | `api/store_import.py` | Product 생성 시 brand, maker 매핑 | 1, 4 |
| 6 | `CLAUDE.md` | API 명세 업데이트 | 전체 완료 후 |

## 영향 분석

### 영향 받는 기능
- 상품 생성/수정 API → 새 필드 수신 및 저장
- 상품 조회 API (상세/목록) → 새 필드 응답에 포함
- 스토어 import → brand, maker 자동 매핑

### 영향 없는 기능
- 크롤링 엔진 (기존 model_code/spec_keywords 로직 불변)
- 블랙리스트 기능
- 알림 시스템
- 비용/마진 계산
- 대시보드

## 프론트엔드 연동 명세 (Codex용)

### 타입 변경
```typescript
// types/index.ts
interface Product {
  // ... 기존 필드 ...
  brand?: string | null;
  maker?: string | null;
  series?: string | null;
  capacity?: string | null;
  color?: string | null;
  material?: string | null;
  product_attributes?: Record<string, string> | null;
}

// ProductListItem에 추가
interface ProductListItem {
  // ... 기존 필드 ...
  model_code?: string | null;
  brand?: string | null;
}
```

### API 호출 예시
```typescript
// 상품 생성
POST /users/{user_id}/products
Body: {
  name: "삼성 갤럭시 S25 울트라 256GB 블랙",
  selling_price: 1500000,
  cost_price: 1200000,
  model_code: "SM-S938N",
  brand: "삼성",
  maker: "삼성전자",
  series: "갤럭시 S25",
  capacity: "256GB",
  color: "블랙"
}

// 상품 수정 (부분 업데이트)
PUT /products/{id}
Body: { brand: "Samsung", color: "Titanium Black" }
```

### UI 제안
- 상품 등록/수정: "제품 속성" 접기 섹션으로 분리 (필수 아님)
- 상품 상세: 제품 정보 카드에 속성 표시 (brand, model_code, series 등)
- 상품 목록: brand 뱃지 표시 (옵션)
