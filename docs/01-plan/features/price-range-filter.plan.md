# Plan: 가격 범위 필터 (Price Range Filter)

## 개요
현재 크롤링 결과에서 동일 모델이지만 **규격(수량/용량)이 다른 상품**이 경쟁사로 잡히는 문제.
예: 내 상품 "24개입 50,000원" vs 경쟁사 "낱개 2,000원" → 최저가가 2,000원으로 표시됨.

기존 `model_code` + `spec_keywords` 필터링은 상품명 부분매칭 방식이라,
규격 키워드가 상품명에 없는 경우(낱개 판매자가 "1개"를 표기하지 않는 경우) 걸러내지 못함.

## 현재 상태 (As-Is)
- `_check_relevance()`: model_code 포함 여부 + spec_keywords 포함 여부만 체크
- 가격 기반 필터링 없음 → 가격이 극단적으로 다른 상품도 관련 상품으로 처리
- 사용자가 수동으로 블랙리스트(Ban)해야 해결 가능
- 규격 키워드를 설정해도, 경쟁사 상품명에 해당 키워드가 없으면 필터링 불가

## 목표 상태 (To-Be)
- 상품별 **가격 하한/상한 퍼센트** 설정 가능
- 크롤링 시 내 판매가 대비 설정 범위 밖의 상품은 자동으로 `is_relevant=false` 처리
- 미설정 시 기존대로 동작 (하위 호환)
- UI에서 직관적으로 설정 가능 (프론트엔드 별도 작업)

## 필터 로직

```
내 판매가: 50,000원
하한: 30% → 최소 15,000원
상한: 200% → 최대 100,000원

경쟁사 A: 48,000원 → 관련 (범위 내)
경쟁사 B: 2,000원  → 비관련 (하한 미달, 낱개 추정)
경쟁사 C: 150,000원 → 비관련 (상한 초과, 대용량 추정)
```

## 기본값 설계
| 필드 | 기본값 | 설명 |
|------|--------|------|
| `price_filter_min_pct` | `null` (미사용) | 최소 가격 (판매가의 N%) |
| `price_filter_max_pct` | `null` (미사용) | 최대 가격 (판매가의 N%) |

- 둘 다 `null`이면 가격 필터 비활성 (기존 동작)
- 하나만 설정해도 동작 (예: 하한만 30% → 상한은 무제한)

## 변경 범위

### 1. DB 모델 (`models/product.py`)
- `price_filter_min_pct: Mapped[int | None]` 추가 (0~100, 판매가의 하한 %)
- `price_filter_max_pct: Mapped[int | None]` 추가 (100~, 판매가의 상한 %)

### 2. 스키마 (`schemas/product.py`)
- `ProductCreate`, `ProductUpdate`에 두 필드 추가
- `ProductResponse`, `ProductDetail`에 두 필드 추가

### 3. 크롤링 관련성 판별 (`crawlers/manager.py`)
- `_check_relevance()` 함수에 가격 범위 체크 추가
- `item.price`와 `product.selling_price` 비교
- 배송비 포함 총액(`item.price + item.shipping_fee`) 기준으로 비교

### 4. 마이그레이션 (`main.py`)
- `alter_statements`에 두 컬럼 추가

### 5. API 문서 (`CLAUDE.md`)
- 변경 이력 추가

## 변경하지 않는 것
- 프론트엔드 (Codex 담당, CLAUDE.md에 API 명세만 기록)
- 기존 model_code / spec_keywords 필터링 (유지, 가격 필터와 AND 조건)
- 블랙리스트 시스템 (유지)

## 검증 계획
| 시나리오 | 기대 결과 |
|----------|----------|
| 하한 30% 설정, 경쟁사 가격이 판매가의 10% | `is_relevant=false` |
| 상한 200% 설정, 경쟁사 가격이 판매가의 300% | `is_relevant=false` |
| 범위 내 가격의 경쟁사 | `is_relevant=true` (기존 동작) |
| 필터 미설정 (null) | 모든 상품 `is_relevant=true` (기존 동작) |
| 가격 필터 + model_code 필터 동시 적용 | AND 조건으로 둘 다 통과해야 관련 |
| 배송비 포함 가격 기준 필터링 | `price + shipping_fee` 기준 |
