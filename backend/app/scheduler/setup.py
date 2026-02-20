import asyncio
import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from app.core.config import settings
from app.scheduler.jobs import crawl_all_users

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


def init_scheduler():
    scheduler.add_job(
        crawl_all_users,
        trigger=IntervalTrigger(minutes=settings.CRAWL_DEFAULT_INTERVAL_MIN),
        id="crawl_scheduled",
        name="전체 크롤링",
        replace_existing=True,
        misfire_grace_time=300,
    )
    scheduler.start()
    logger.info(f"스케줄러 시작 (크롤링 주기: {settings.CRAWL_DEFAULT_INTERVAL_MIN}분)")


def shutdown_scheduler():
    scheduler.shutdown()
    logger.info("스케줄러 종료")
