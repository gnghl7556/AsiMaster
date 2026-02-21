# Plan: 키워드별 정렬 유형 (노출 순위 / 가격 순위)

## 개요
현재 네이버 쇼핑 API 크롤링 시 `sort=sim`(관련도순)으로 고정되어 있어, 검색 결과가 "노출 순위"만 반영된다.
키워드별로 `sim`(노출 순위) 또는 `asc`(가격 낮은순, 가격 순위)를 선택할 수 있도록 하여,
사용자가 두 가지 관점에서 경쟁 상황을 모니터링할 수 있게 한다.

## 현재 상태 (As-Is)
- `naver.py`: `sort="sim"` 하드코딩
- `SearchKeyword` 모델: 정렬 유형 필드 없음
- 모든 키워드가 동일한 관련도순 기준으로 크롤링됨
- UI에서 순위 표시 시 노출 순위인지 가격 순위인지 구분 불가

## 목표 상태 (To-Be)
- 키워드별로 `sort_type` 필드 추가 (`sim` | `asc`, 기본값: `sim`)
- 크롤링 시 해당 키워드의 `sort_type`에 맞는 정렬로 API 호출
- API 응답에 `sort_type` 포함하여 프론트엔드에서 구분 표시 가능

## 정렬 유형 정의
| sort_type | 의미 | 네이버 API sort | 설명 |
|-----------|------|----------------|------|
| `sim` | 노출 순위 | `sim` (관련도순) | 네이버 쇼핑 검색 시 기본 노출 순서 |
| `asc` | 가격 순위 | `asc` (가격낮은순) | 가격이 낮은 순서대로 정렬 |

## 변경 범위

### 1. DB 모델 변경
- **SearchKeyword**: `sort_type: str` 컬럼 추가 (기본값 `"sim"`, 최대 10자)
- 마이그레이션: `main.py` lifespan에서 ALTER TABLE 처리

### 2. Pydantic 스키마 변경
- **KeywordCreate**: `sort_type: str` 필드 추가 (기본값 `"sim"`, `sim`|`asc` 검증)
- **KeywordResponse**: `sort_type: str` 필드 추가
- **RankingItemResponse**: 변경 없음 (keyword 레벨에서 이미 구분 가능)

### 3. 크롤러 변경
- **naver.py** `search_products()`: `sort` 파라미터를 인자로 받도록 변경
- **manager.py** `_crawl_keyword()`: keyword.sort_type을 크롤러에 전달

### 4. API 변경
- **POST /products/{product_id}/keywords**: `sort_type` 필드 수신
- **GET /products/{product_id}/keywords**: 응답에 `sort_type` 포함
- **상품 상세 API**: 키워드별 순위 데이터에 `sort_type` 포함

### 5. 프론트엔드 (Codex 담당)
- 키워드 추가 시 정렬 유형 선택 UI
- 순위 목록에서 정렬 유형 라벨 표시 (예: "노출 순위", "가격 순위")

## 기존 데이터 호환성
- 기존 키워드는 `sort_type` 기본값 `"sim"`으로 자동 설정
- 기존 크롤링 데이터(KeywordRanking)는 영향 없음 (모두 sim 기준)

## 구현 순서
1. SearchKeyword 모델에 `sort_type` 컬럼 추가 + 마이그레이션
2. Pydantic 스키마 업데이트 (KeywordCreate, KeywordResponse)
3. naver.py 크롤러 sort 파라미터 동적 처리
4. manager.py에서 keyword.sort_type 전달
5. 키워드 API 엔드포인트 수정
6. 상품 상세 API 응답에 sort_type 포함
7. CLAUDE.md API 명세 업데이트

## 리스크
- **네이버 API 제한**: sort 파라미터 변경 시 응답 구조가 동일한지 확인 필요 (동일함 확인됨)
- **가격 순위 크롤링의 의미**: `sort=asc`는 가격만 기준이므로 관련 없는 상품이 많이 포함될 수 있음 → `is_relevant` 필터링이 더 중요해짐
