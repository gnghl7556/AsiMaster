"""토큰 분류기 — 상품명 토큰을 11개 카테고리로 분류."""
from __future__ import annotations

import re
from dataclasses import dataclass

from app.services.keyword_engine.weights import WEIGHTS

# ---------------------------------------------------------------------------
# 데이터 클래스
# ---------------------------------------------------------------------------


@dataclass
class ClassifiedToken:
    text: str
    category: str
    weight: int
    source: str  # "regex" | "dict" | "db"


# ---------------------------------------------------------------------------
# 정규식 패턴 (1단계)
# ---------------------------------------------------------------------------

_CAPACITY_RE = re.compile(
    r"^\d+(?:\.\d+)?(?:ml|mL|ML|L|l|g|kg|KG|oz|cc|리터)$",
    re.IGNORECASE,
)

# MODEL은 CAPACITY/SIZE/QUANTITY 이후에 체크 (870L → CAPACITY, 2030W → MODEL)
_MODEL_RE = re.compile(
    r"^[A-Za-z]{1,5}[\d]+[A-Za-z0-9]{2,}$"   # RF85B9121AP, SL2030W 등 (알파벳 시작 + 숫자 + 후속 2자 이상)
    r"|^[A-Za-z]{0,3}\d{5,}[A-Za-z0-9]*$"     # 모델번호 5자리+ (12345AB 등)
    r"|^\d{3,4}[A-Za-z]{2,}\d*$"               # 2030WX 등 (3~4자리 숫자 + 알파벳 2자 이상)
)

_SIZE_RE = re.compile(
    r"^\d+(?:\.\d+)?(?:cm|mm|m|인치|inch)$"
    r"|^(?:소형|중형|대형|특대형|특대|미니|점보|슬림|와이드|컴팩트)$",
    re.IGNORECASE,
)

_QUANTITY_RE = re.compile(
    r"^\d+(?:개입|개|매|장|롤|팩|박스|캔|병|봉|포|세트|묶음|켤레|족|입|ea|pcs|pack)$",
    re.IGNORECASE,
)


# ---------------------------------------------------------------------------
# 내장 사전 (2단계)
# ---------------------------------------------------------------------------

_BRANDS = {
    # 한국 대형 브랜드
    "삼성", "삼성전자", "lg", "lg전자", "현대", "sk", "cj", "롯데",
    "카카오", "네이버", "쿠쿠", "위니아", "대우", "한화", "코웨이",
    # 글로벌 브랜드
    "apple", "아이폰", "갤럭시", "sony", "소니", "philips", "필립스",
    "dyson", "다이슨", "bosch", "보쉬", "panasonic", "파나소닉",
    "xiaomi", "샤오미", "lenovo", "레노버", "hp", "dell", "asus",
    "nike", "나이키", "adidas", "아디다스", "new balance", "뉴발란스",
    # 한국 식품/생활
    "오뚜기", "농심", "풀무원", "해태", "크라운", "빙그레", "매일유업",
    "남양유업", "동서식품", "삼양", "오리온", "하림", "청정원", "비비고",
    # 가구/생활
    "한샘", "이케아", "시디즈", "에이스", "일룸", "리바트",
    # 뷰티
    "아모레", "이니스프리", "설화수", "라네즈", "미샤", "더페이스샵",
    # 유아
    "보솜이", "하기스", "팸퍼스", "유한킴벌리", "깨끗한나라",
    # 기타
    "3m", "듀라셀", "에너자이저", "코카콜라", "펩시",
    "무인양품", "다이소", "모나미", "스타벅스",
}
_BRANDS_LOWER = {b.lower() for b in _BRANDS}

_COLORS = {
    "빨강", "빨간", "레드", "red", "파랑", "파란", "블루", "blue",
    "초록", "그린", "green", "노랑", "노란", "옐로우", "yellow",
    "검정", "검은", "블랙", "black", "흰", "화이트", "white",
    "회색", "그레이", "gray", "grey", "핑크", "pink",
    "보라", "퍼플", "purple", "오렌지", "orange",
    "베이지", "beige", "브라운", "brown", "갈색",
    "네이비", "navy", "민트", "mint", "아이보리", "ivory",
    "골드", "gold", "실버", "silver", "로즈골드",
}
_COLORS_LOWER = {c.lower() for c in _COLORS}

_MATERIALS = {
    "스테인리스", "스틸", "알루미늄", "실리콘", "나무", "원목", "대나무",
    "유리", "도자기", "세라믹", "플라스틱", "가죽", "천연가죽", "인조가죽",
    "면", "실크", "린넨", "폴리에스터", "나일론", "울", "캐시미어",
    "고무", "티타늄", "구리", "황동",
}
_MATERIALS_LOWER = {m.lower() for m in _MATERIALS}

_MODIFIERS = {
    "무료배송", "당일배송", "즉시배송", "빠른배송",
    "할인", "특가", "세일", "이벤트", "프로모션",
    "정품", "병행수입", "국내배송", "해외직구",
    "추천", "인기", "베스트", "1위", "판매1위",
    "새상품", "리퍼", "중고", "전시품",
    "무료", "사은품", "증정", "덤",
    "국산", "수입", "정식수입",
}
_MODIFIERS_LOWER = {m.lower() for m in _MODIFIERS}


# ---------------------------------------------------------------------------
# 분류 함수
# ---------------------------------------------------------------------------

def classify_tokens(
    product_name: str,
    db_brands: set[str] | None = None,
    db_types: set[str] | None = None,
) -> list[ClassifiedToken]:
    """상품명을 토큰으로 분류.

    Args:
        product_name: 상품명
        db_brands: DB에서 가져온 브랜드/제조사 집합 (소문자)
        db_types: DB에서 가져온 카테고리 집합 (소문자)
    """
    tokens = _tokenize(product_name)
    result: list[ClassifiedToken] = []

    for token in tokens:
        classified = _classify_single(token, db_brands, db_types)
        result.append(classified)

    return result


def _tokenize(name: str) -> list[str]:
    """상품명을 의미 단위로 토큰화."""
    # HTML 태그 제거
    name = re.sub(r"<[^>]+>", "", name)
    # 괄호 내용을 별도 토큰으로 분리
    name = re.sub(r"[\[\](){}]", " ", name)
    # 특수문자 정리 (하이픈은 모델명에서 유지)
    name = re.sub(r"[,·/+|~!@#$%^&*=]", " ", name)

    tokens = []
    for raw in name.split():
        raw = raw.strip()
        if not raw:
            continue

        # 수량+단위가 붙어있는 경우 분리하지 않음 (200ml, 10개입 등)
        if _QUANTITY_RE.match(raw) or _CAPACITY_RE.match(raw):
            tokens.append(raw)
            continue

        # 모델명 패턴이면 그대로 유지
        if _MODEL_RE.match(raw):
            tokens.append(raw)
            continue

        tokens.append(raw)

    return tokens


def _classify_single(
    token: str,
    db_brands: set[str] | None,
    db_types: set[str] | None,
) -> ClassifiedToken:
    """단일 토큰 분류."""
    lower = token.lower()

    # 1단계: 정규식 (CAPACITY/SIZE/QUANTITY를 MODEL보다 먼저 체크)
    if _CAPACITY_RE.match(token):
        return ClassifiedToken(token, "CAPACITY", WEIGHTS["CAPACITY"], "regex")
    if _SIZE_RE.match(token):
        return ClassifiedToken(token, "SIZE", WEIGHTS["SIZE"], "regex")
    if _QUANTITY_RE.match(token):
        return ClassifiedToken(token, "QUANTITY", WEIGHTS["QUANTITY"], "regex")
    if _MODEL_RE.match(token):
        return ClassifiedToken(token, "MODEL", WEIGHTS["MODEL"], "regex")

    # 2단계: 내장 사전
    if lower in _MODIFIERS_LOWER:
        return ClassifiedToken(token, "MODIFIER", WEIGHTS["MODIFIER"], "dict")
    if lower in _COLORS_LOWER:
        return ClassifiedToken(token, "COLOR", WEIGHTS["COLOR"], "dict")
    if lower in _MATERIALS_LOWER:
        return ClassifiedToken(token, "MATERIAL", WEIGHTS["MATERIAL"], "dict")
    if lower in _BRANDS_LOWER:
        return ClassifiedToken(token, "BRAND", WEIGHTS["BRAND"], "dict")

    # 3단계: DB 사전
    if db_brands and lower in db_brands:
        return ClassifiedToken(token, "BRAND", WEIGHTS["BRAND"], "db")
    if db_types and lower in db_types:
        return ClassifiedToken(token, "TYPE", WEIGHTS["TYPE"], "db")

    # 기본: 첫 번째 토큰이면 BRAND 추정, 아니면 TYPE
    # (caller에서 위치 정보가 필요하므로 FEATURE로 분류)
    return ClassifiedToken(token, "FEATURE", WEIGHTS["FEATURE"], "dict")
