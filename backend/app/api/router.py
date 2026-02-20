from fastapi import APIRouter

from app.api.alerts import router as alerts_router
from app.api.costs import router as costs_router
from app.api.crawl import router as crawl_router
from app.api.dashboard import router as dashboard_router
from app.api.keywords import router as keywords_router
from app.api.margins import router as margins_router
from app.api.prices import router as prices_router
from app.api.products import router as products_router
from app.api.users import router as users_router

api_router = APIRouter()
api_router.include_router(users_router)
api_router.include_router(products_router)
api_router.include_router(keywords_router)
api_router.include_router(costs_router)
api_router.include_router(margins_router)
api_router.include_router(alerts_router)
api_router.include_router(prices_router)
api_router.include_router(dashboard_router)
api_router.include_router(crawl_router)
