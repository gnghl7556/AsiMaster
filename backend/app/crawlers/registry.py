from app.crawlers.base import BaseCrawler
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


# 네이버만 등록
CrawlerRegistry.register("naver", NaverCrawler)
