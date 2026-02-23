"""SEO 가중치 설정."""

WEIGHTS: dict[str, int] = {
    "MODEL": 10,
    "BRAND": 9,
    "TYPE": 9,
    "SERIES": 7,
    "CAPACITY": 5,
    "QUANTITY": 4,
    "SIZE": 4,
    "COLOR": 3,
    "MATERIAL": 3,
    "FEATURE": 3,
    "MODIFIER": -2,
}
