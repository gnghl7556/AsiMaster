from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db
from app.schemas.category import NaverCategoryTree

router = APIRouter(tags=["categories"])


@router.get("/naver-categories", response_model=NaverCategoryTree)
async def get_naver_categories(db: AsyncSession = Depends(get_db)):
    """크롤링된 keyword_rankings에서 네이버 카테고리 트리 구조를 반환."""
    result = await db.execute(text("""
        SELECT
            category1,
            category2,
            category3,
            category4,
            COUNT(*) as cnt
        FROM keyword_rankings
        WHERE category1 IS NOT NULL AND category1 != ''
        GROUP BY category1, category2, category3, category4
        ORDER BY category1, category2, category3, category4
    """))
    rows = result.fetchall()

    # 트리 구조 빌드
    tree: dict = {}
    total_paths = 0

    for cat1, cat2, cat3, cat4, cnt in rows:
        total_paths += 1

        if cat1 not in tree:
            tree[cat1] = {"name": cat1, "product_count": 0, "children": {}}
        tree[cat1]["product_count"] += cnt

        if cat2:
            if cat2 not in tree[cat1]["children"]:
                tree[cat1]["children"][cat2] = {"name": cat2, "product_count": 0, "children": {}}
            tree[cat1]["children"][cat2]["product_count"] += cnt

            if cat3:
                if cat3 not in tree[cat1]["children"][cat2]["children"]:
                    tree[cat1]["children"][cat2]["children"][cat3] = {"name": cat3, "product_count": 0, "children": {}}
                tree[cat1]["children"][cat2]["children"][cat3]["product_count"] += cnt

                if cat4:
                    if cat4 not in tree[cat1]["children"][cat2]["children"][cat3]["children"]:
                        tree[cat1]["children"][cat2]["children"][cat3]["children"][cat4] = {"name": cat4, "product_count": 0, "children": {}}
                    tree[cat1]["children"][cat2]["children"][cat3]["children"][cat4]["product_count"] += cnt

    def _to_list(d: dict) -> list:
        return sorted(
            [
                {
                    "name": v["name"],
                    "product_count": v["product_count"],
                    "children": _to_list(v["children"]),
                }
                for v in d.values()
            ],
            key=lambda x: -x["product_count"],
        )

    return {
        "categories": _to_list(tree),
        "total_paths": total_paths,
    }
