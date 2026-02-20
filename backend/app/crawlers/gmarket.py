from bs4 import BeautifulSoup

from app.crawlers.base import BaseCrawler, CrawlResult


class GmarketCrawler(BaseCrawler):
    platform_name = "gmarket"
    url_patterns = ["gmarket.co.kr"]

    async def fetch(self, url: str) -> CrawlResult:
        try:
            html = await self._get_page_html(url)
            soup = BeautifulSoup(html, "html.parser")

            price = self._extract_price(soup)
            shipping_fee = self._extract_shipping(soup)

            if price is None:
                return CrawlResult(success=False, error="가격 추출 실패")

            return CrawlResult(
                price=price,
                shipping_fee=shipping_fee,
            )
        except Exception as e:
            return CrawlResult(success=False, error=str(e))

    def _extract_price(self, soup: BeautifulSoup) -> int | None:
        selectors = [
            "span.price_real",
            "strong.price_real",
            "span.item_price",
        ]
        for selector in selectors:
            el = soup.select_one(selector)
            if el:
                return self.parse_price(el.get_text())
        return None

    def _extract_shipping(self, soup: BeautifulSoup) -> int:
        el = soup.select_one("span.delivery_price")
        if el:
            text = el.get_text()
            if "무료" in text:
                return 0
            parsed = self.parse_price(text)
            if parsed:
                return parsed
        return 0
