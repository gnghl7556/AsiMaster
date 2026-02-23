import asyncio
import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from app.core.config import settings
from app.scheduler.jobs import crawl_all_users, cleanup_old_rankings

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


def init_scheduler():
    check_interval = 10  # 10분마다 체크, 실제 크롤링은 유저별 주기에 따라 실행
    scheduler.add_job(
        crawl_all_users,
        trigger=IntervalTrigger(minutes=check_interval),
        id="crawl_scheduled",
        name="전체 크롤링",
        replace_existing=True,
        misfire_grace_time=300,
        max_instances=1,
    )
    scheduler.add_job(
        cleanup_old_rankings,
        trigger=IntervalTrigger(hours=24),
        id="cleanup_old_data",
        name="30일 이전 데이터 정리",
        replace_existing=True,
        misfire_grace_time=3600,
        max_instances=1,
    )
    scheduler.start()
    logger.info(f"스케줄러 시작 (체크 주기: {check_interval}분, 유저별 크롤링 주기 적용)")


def shutdown_scheduler():
    scheduler.shutdown()
    logger.info("스케줄러 종료")
