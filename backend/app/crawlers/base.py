import asyncio
import random
import re
from abc import ABC, abstractmethod
from dataclasses import dataclass, field

from playwright.async_api import async_playwright

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0",
    "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
]


@dataclass
class CrawlResult:
    price: int | None = None
    shipping_fee: int = 0
    seller_name: str | None = None
    ranking: int | None = None
    total_sellers: int | None = None
    success: bool = True
    error: str | None = None


class BaseCrawler(ABC):
    platform_name: str = ""
    url_patterns: list[str] = []
    delay_min: int = 2
    delay_max: int = 5

    def validate_url(self, url: str) -> bool:
        return any(pattern in url for pattern in self.url_patterns)

    @abstractmethod
    async def fetch(self, url: str) -> CrawlResult:
        pass

    async def _get_page_html(self, url: str) -> str:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                user_agent=random.choice(USER_AGENTS),
                viewport={"width": 1920, "height": 1080},
            )
            page = await context.new_page()
            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=15000)
                await page.wait_for_timeout(2000)
                html = await page.content()
                return html
            finally:
                await browser.close()

    @staticmethod
    def parse_price(text: str) -> int | None:
        if not text:
            return None
        cleaned = re.sub(r"[^\d]", "", text.strip())
        return int(cleaned) if cleaned else None

    async def delay(self):
        wait = random.uniform(self.delay_min, self.delay_max)
        await asyncio.sleep(wait)
