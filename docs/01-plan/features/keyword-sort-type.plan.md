# Plan: 키워드별 정렬 유형 (노출 순위 / 가격 순위)

## 개요
현재 네이버 쇼핑 API 크롤링 시 `sort=sim`(관련도순)으로 고정되어 있어, 검색 결과가 "노출 순위"만 반영된다.
키워드별로 `sim`(노출 순위) 또는 `asc`(가격 낮은순, 가격 순위)를 선택할 수 있도록 하여,
사용자가 두 가지 관점에서 경쟁 상황을 모니터링할 수 있게 한다.

## 현재 상태 (As-Is)
- `naver.py`: `sort="sim"` 하드코딩
- `SearchKeyword` 모델: `sort_type` 필드 없음 (단, DB에는 ALTER TABLE로 컬럼 이미 존재)
- `manager.py`: `_fetch_keyword(keyword_str)` → sort 파라미터 전달 불가
- `BaseCrawler.search_keyword(keyword)` → sort 파라미터 없음
- 모든 키워드가 동일한 관련도순 기준으로 크롤링됨
- UI에서 순위 표시 시 노출 순위인지 가격 순위인지 구분 불가

## 목표 상태 (To-Be)
- 키워드별로 `sort_type` 필드 사용 (`sim` | `asc`, 기본값: `sim`)
- 크롤링 시 해당 키워드의 `sort_type`에 맞는 정렬로 API 호출
- API 응답에 `sort_type` 포함하여 프론트엔드에서 구분 표시 가능
- 프론트엔드에서 키워드 추가 시 정렬 유형 선택 가능

## 정렬 유형 정의
| sort_type | 표시명 | 네이버 API sort | 설명 |
|-----------|--------|----------------|------|
| `sim` | 노출 순위 | `sim` (관련도순) | 네이버 쇼핑 검색 시 기본 노출 순서 |
| `asc` | 가격 순위 | `asc` (가격낮은순) | 가격이 낮은 순서대로 정렬 |

## 변경 범위

### 1. DB 모델 변경 (`search_keyword.py`)
- `SearchKeyword` 클래스에 `sort_type: Mapped[str]` 필드 추가 (String(10), default="sim")
- DB 컬럼은 `main.py` ALTER TABLE에 이미 존재 → 모델만 추가하면 됨

### 2. Pydantic 스키마 변경 (`search_keyword.py`)
- `KeywordCreate`: `sort_type: str` 필드 추가 (기본값 `"sim"`, Literal["sim", "asc"] 검증)
- `KeywordResponse`: `sort_type: str` 필드 추가

### 3. 크롤러 변경
- **`base.py`** `BaseCrawler.search_keyword()`: `sort_type: str = "sim"` 파라미터 추가
- **`naver.py`** `NaverCrawler.search_keyword()`: `sort_type` 파라미터 받아서 API params에 전달
- **`manager.py`**:
  - `_fetch_keyword()`: `sort_type` 파라미터 추가
  - `_save_keyword_result()`: 변경 없음 (결과 저장은 sort_type 무관)
  - `crawl_product()`, `crawl_user_all()`: keyword.sort_type을 `_fetch_keyword()`에 전달

### 4. API 변경 (`keywords.py`)
- `POST /products/{product_id}/keywords`: `sort_type` 필드 수신 + SearchKeyword 생성 시 반영
- `GET /products/{product_id}/keywords`: 응답에 `sort_type` 자동 포함 (from_attributes)

### 5. 상품 상세 API 변경 (`product_service.py`)
- `keywords_data` 딕셔너리에 `sort_type` 필드 추가

### 6. 프론트엔드 (Codex 담당)
- 키워드 추가 시 정렬 유형 선택 UI (드롭다운: "노출 순위" / "가격 순위")
- 키워드별 순위 목록에 정렬 유형 라벨 표시 (예: "노출 순위", "가격 순위")
- 타입 정의에 `sort_type` 추가

## 기존 데이터 호환성
- DB 컬럼 기본값이 `'sim'` → 기존 키워드는 자동으로 노출 순위로 동작
- 기존 크롤링 결과(KeywordRanking)는 영향 없음 (모두 sim 기준이었음)
- 모델 필드 추가만으로 즉시 호환

## 구현 순서
1. `SearchKeyword` 모델에 `sort_type` 필드 추가
2. `KeywordCreate`, `KeywordResponse` 스키마 업데이트
3. `BaseCrawler.search_keyword()` 시그니처 변경
4. `NaverCrawler.search_keyword()` sort 파라미터 동적 처리
5. `CrawlManager._fetch_keyword()` → sort_type 전달
6. `CrawlManager.crawl_product()`, `crawl_user_all()` → keyword.sort_type 전달
7. `keywords.py` API에서 sort_type 수신/저장
8. `product_service.py` 상품 상세 응답에 sort_type 포함
9. CLAUDE.md API 명세 업데이트

## 수정 파일 목록 (백엔드 9개)
| 파일 | 변경 내용 |
|------|----------|
| `models/search_keyword.py` | sort_type 필드 추가 |
| `schemas/search_keyword.py` | KeywordCreate, KeywordResponse에 sort_type 추가 |
| `crawlers/base.py` | search_keyword() 시그니처 변경 |
| `crawlers/naver.py` | sort 파라미터 동적 처리 |
| `crawlers/manager.py` | _fetch_keyword, crawl_product, crawl_user_all 수정 |
| `api/keywords.py` | create_keyword에서 sort_type 저장 |
| `services/product_service.py` | keywords_data에 sort_type 포함 |
| `api/store_import.py` | import 시 기본 키워드 sort_type 설정 (선택) |
| `CLAUDE.md` | API 명세 업데이트 |

## 리스크
- **네이버 API 응답 구조**: sort 파라미터 변경해도 응답 JSON 구조는 동일 (확인됨)
- **가격 순위의 관련성**: `sort=asc`는 가격만 기준이므로 관련 없는 상품이 포함될 수 있음 → 기존 `is_relevant` 필터링이 중요
- **순위 의미 차이**: 노출 순위 1위 vs 가격 순위 1위의 의미가 다름 → UI에서 명확한 라벨 필요
