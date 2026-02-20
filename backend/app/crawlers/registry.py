from app.crawlers.auction import AuctionCrawler
from app.crawlers.base import BaseCrawler
from app.crawlers.coupang import CoupangCrawler
from app.crawlers.gmarket import GmarketCrawler
from app.crawlers.naver import NaverCrawler


class CrawlerRegistry:
    _crawlers: dict[str, type[BaseCrawler]] = {}

    @classmethod
    def register(cls, platform: str, crawler_cls: type[BaseCrawler]):
        cls._crawlers[platform] = crawler_cls

    @classmethod
    def get(cls, platform: str) -> BaseCrawler | None:
        crawler_cls = cls._crawlers.get(platform)
        if crawler_cls:
            return crawler_cls()
        return None

    @classmethod
    def get_all(cls) -> dict[str, BaseCrawler]:
        return {name: cls() for name, cls in cls._crawlers.items()}

    @classmethod
    def detect_platform(cls, url: str) -> str | None:
        for name, crawler_cls in cls._crawlers.items():
            instance = crawler_cls()
            if instance.validate_url(url):
                return name
        return None


# 기본 크롤러 등록
CrawlerRegistry.register("naver", NaverCrawler)
CrawlerRegistry.register("coupang", CoupangCrawler)
CrawlerRegistry.register("gmarket", GmarketCrawler)
CrawlerRegistry.register("auction", AuctionCrawler)
