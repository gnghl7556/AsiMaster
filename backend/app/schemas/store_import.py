from pydantic import BaseModel, Field


class StoreProductItem(BaseModel):
    """스크래핑된 스토어 상품 (미리보기용)."""
    name: str
    price: int
    image_url: str
    category: str
    naver_product_id: str
    suggested_keywords: list[str] = []


class StoreImportItem(BaseModel):
    """등록할 개별 상품."""
    name: str = Field(..., min_length=1, max_length=200)
    selling_price: int = Field(..., ge=0)
    image_url: str | None = None
    category: str | None = None
    keywords: list[str] | None = None


class StoreImportRequest(BaseModel):
    """선택한 상품 일괄 등록 요청."""
    products: list[StoreImportItem] = Field(..., min_length=1)


class StoreImportResult(BaseModel):
    """등록 결과."""
    created: int
    skipped: int
    skipped_names: list[str]
