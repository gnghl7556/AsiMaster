from __future__ import annotations

from pydantic import BaseModel


class NaverCategory(BaseModel):
    name: str
    product_count: int
    children: list[NaverCategory]


class NaverCategoryTree(BaseModel):
    categories: list[NaverCategory]
    total_paths: int
