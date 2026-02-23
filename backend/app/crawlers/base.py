from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class RankingItem:
    rank: int
    product_name: str
    price: int
    mall_name: str = ""
    product_url: str = ""
    image_url: str = ""
    naver_product_id: str = ""
    hprice: int = 0
    brand: str = ""
    maker: str = ""
    product_type: str = ""
    category1: str = ""
    category2: str = ""
    category3: str = ""
    category4: str = ""
    shipping_fee: int = 0


@dataclass
class KeywordCrawlResult:
    keyword: str = ""
    items: list[RankingItem] = field(default_factory=list)
    success: bool = True
    error: str | None = None


class BaseCrawler(ABC):
    platform_name: str = ""

    @abstractmethod
    async def search_keyword(self, keyword: str, sort_type: str = "sim") -> KeywordCrawlResult:
        pass
