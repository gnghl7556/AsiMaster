from app.crawlers.naver import NaverCrawler

# 네이버만 사용 - NaverCrawler는 manager.py에서 직접 참조
__all__ = ["NaverCrawler"]
