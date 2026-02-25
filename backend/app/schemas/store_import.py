from pydantic import BaseModel, Field


class StoreProductItem(BaseModel):
    """스크래핑된 스토어 상품 (미리보기용)."""
    name: str
    price: int
    image_url: str
    category: str
    naver_product_id: str
    brand: str = ""
    maker: str = ""
    suggested_keywords: list[str] = []


class StoreImportItem(BaseModel):
    """등록할 개별 상품."""
    name: str = Field(..., min_length=1, max_length=200)
    selling_price: int = Field(..., ge=0)
    image_url: str | None = None
    category: str | None = None
    naver_product_id: str | None = None
    keywords: list[str] | None = None
    # 검색 정확도 설정 (ProductCreate/Update와 동일 검증)
    model_code: str | None = Field(None, max_length=100)
    spec_keywords: list[str] | None = None
    price_filter_min_pct: int | None = Field(None, ge=0, le=100)
    price_filter_max_pct: int | None = Field(None, ge=100)


class StoreImportRequest(BaseModel):
    """선택한 상품 일괄 등록 요청."""
    products: list[StoreImportItem] = Field(..., min_length=1, max_length=100)


class CreatedProductMapping(BaseModel):
    """생성된 상품의 이름 → ID 매핑."""
    name: str
    product_id: int


class StoreImportResult(BaseModel):
    """등록 결과."""
    created: int
    skipped: int
    skipped_names: list[str]
    created_products: list[CreatedProductMapping] = []
