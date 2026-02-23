from pydantic import BaseModel, Field


class KeywordSuggestRequest(BaseModel):
    product_name: str = Field(..., min_length=1, max_length=300)
    store_name: str | None = None
    category_hint: str | None = None


class TokenItem(BaseModel):
    text: str
    category: str
    weight: int


class SuggestedKeyword(BaseModel):
    keyword: str
    score: int
    level: str  # "specific" | "medium" | "broad"


class KeywordSuggestionResponse(BaseModel):
    tokens: list[TokenItem]
    keywords: list[SuggestedKeyword]
    field_guide: dict[str, str | None]
