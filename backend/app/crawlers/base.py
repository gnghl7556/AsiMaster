from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class CrawlResult:
    price: int | None = None
    shipping_fee: int = 0
    seller_name: str | None = None
    product_url: str | None = None
    ranking: int | None = None
    total_sellers: int | None = None
    success: bool = True
    error: str | None = None


class BaseCrawler(ABC):
    platform_name: str = ""

    @abstractmethod
    async def search(self, product_name: str) -> CrawlResult:
        pass
