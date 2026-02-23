"""SEO 키워드 조합 생성기."""

from dataclasses import dataclass

from app.services.keyword_engine.classifier import ClassifiedToken

_MAX_KEYWORD_LEN = 50
_MIN_WORDS = 2
_MAX_WORDS = 5

# 네이버 표준상품명 순서
_CATEGORY_ORDER = [
    "BRAND", "SERIES", "MODEL", "TYPE",
    "COLOR", "MATERIAL", "QUANTITY", "SIZE", "CAPACITY",
    "FEATURE",
]
_ORDER_MAP = {cat: i for i, cat in enumerate(_CATEGORY_ORDER)}


@dataclass
class GeneratedKeyword:
    keyword: str
    score: int
    level: str  # "specific" | "medium" | "broad"


def generate_keywords(
    tokens: list[ClassifiedToken],
    max_count: int = 5,
) -> list[GeneratedKeyword]:
    """분류된 토큰에서 SEO 키워드 조합 생성.

    조합 규칙:
    - specific 2개 (MODEL 포함)
    - medium 2개 (BRAND/SERIES + TYPE)
    - broad 1개 (TYPE 단독 또는 짧은 조합)
    - MODIFIER 제외, 50자 제한, 2~5 단어
    """
    # MODIFIER 제외한 유효 토큰
    valid = [t for t in tokens if t.category != "MODIFIER"]
    if not valid:
        return []

    # 카테고리별 토큰 그룹핑
    by_cat: dict[str, list[ClassifiedToken]] = {}
    for t in valid:
        by_cat.setdefault(t.category, []).append(t)

    models = by_cat.get("MODEL", [])
    brands = by_cat.get("BRAND", [])
    types = by_cat.get("TYPE", [])
    series = by_cat.get("SERIES", [])
    features = by_cat.get("FEATURE", [])

    candidates: list[GeneratedKeyword] = []

    # --- Specific (MODEL 포함) ---
    if models:
        model = models[0]
        # MODEL + TYPE
        if types:
            _add_combo(candidates, [types[0], model], "specific")
        # BRAND + MODEL
        if brands:
            _add_combo(candidates, [brands[0], model], "specific")
        # MODEL 단독 (2단어 미만이지만 모델명은 예외)
        if len(candidates) < 2:
            candidates.append(GeneratedKeyword(
                keyword=model.text,
                score=model.weight,
                level="specific",
            ))

    # --- Medium (BRAND/SERIES + TYPE) ---
    if brands and types:
        _add_combo(candidates, [brands[0], types[0]], "medium")
    if series and types:
        _add_combo(candidates, [series[0], types[0]], "medium")
    if brands and series:
        _add_combo(candidates, [brands[0], series[0]], "medium")
    # BRAND + TYPE + 부가 속성
    if brands and types and (by_cat.get("CAPACITY") or by_cat.get("QUANTITY")):
        extra = (by_cat.get("CAPACITY") or by_cat.get("QUANTITY"))[0]
        _add_combo(candidates, [brands[0], types[0], extra], "medium")

    # --- Broad ---
    if types:
        t = types[0]
        if features:
            _add_combo(candidates, [features[0], t], "broad")
        else:
            candidates.append(GeneratedKeyword(
                keyword=t.text,
                score=t.weight,
                level="broad",
            ))
    elif features and len(features) >= 2:
        _add_combo(candidates, features[:2], "broad")

    # 전체 토큰 조합 (fallback)
    if len(candidates) < 2:
        all_text = _join_tokens_ordered(valid[:_MAX_WORDS])
        score = sum(t.weight for t in valid[:_MAX_WORDS])
        if all_text and len(all_text) <= _MAX_KEYWORD_LEN:
            candidates.append(GeneratedKeyword(
                keyword=all_text,
                score=score,
                level="medium",
            ))

    # 중복 제거 + score 내림차순 정렬 + max_count 제한
    seen: set[str] = set()
    result: list[GeneratedKeyword] = []
    for c in sorted(candidates, key=lambda x: -x.score):
        key = c.keyword.lower()
        if key in seen:
            continue
        seen.add(key)
        result.append(c)
        if len(result) >= max_count:
            break

    return result


def _add_combo(
    candidates: list[GeneratedKeyword],
    token_list: list[ClassifiedToken],
    level: str,
) -> None:
    """토큰 조합을 후보에 추가 (길이/단어 수 검증)."""
    text = _join_tokens_ordered(token_list)
    word_count = len(text.split())
    if not text or len(text) > _MAX_KEYWORD_LEN:
        return
    if word_count < _MIN_WORDS and level != "specific":
        return
    score = sum(t.weight for t in token_list)
    candidates.append(GeneratedKeyword(keyword=text, score=score, level=level))


def _join_tokens_ordered(tokens: list[ClassifiedToken]) -> str:
    """네이버 표준상품명 순서로 토큰 정렬 후 결합."""
    sorted_tokens = sorted(
        tokens,
        key=lambda t: _ORDER_MAP.get(t.category, 99),
    )
    return " ".join(t.text for t in sorted_tokens).strip()
