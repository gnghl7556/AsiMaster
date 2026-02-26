# Plan: 상품 DB화 (모델명 기반 제품 속성 구조화)

## 개요
현재 상품명(name)은 네이버 쇼핑 노출을 위한 SEO 최적화 문장이라, 고유한 제품 정보를 데이터화하기 어렵다.
모델명(model_code)을 고유 식별자로 사용하고, 브랜드/카테고리/용량/색상/소재/시리즈/제조사 등
제품 속성을 구조화하여 저장함으로써, 이후 제품 비교/분석/재활용에 활용할 수 있도록 한다.

## 현재 상태 (As-Is)
- `Product` 모델에 `model_code`(String 100), `spec_keywords`(JSON) 필드 존재
- **용도가 경쟁사 필터링에 한정**: `_check_relevance()`에서 모델코드+규격키워드 매칭에만 사용
- 제품 속성(브랜드, 용량, 색상 등)이 별도 필드로 저장되지 않음
- `KeywordRanking`에 `brand`, `maker` 필드 존재하지만 경쟁사 데이터 저장용
- SEO 키워드 엔진(`keyword_engine/classifier.py`)에 토큰 분류 로직 존재 (MODEL, BRAND, TYPE, SERIES, CAPACITY, QUANTITY, SIZE, COLOR, MATERIAL, FEATURE, MODIFIER 11종)

## 목표 상태 (To-Be)
- 상품에 구조화된 제품 속성 필드를 추가하여 고유 제품 정보를 체계적으로 저장
- 모델명(model_code)이 제품의 고유 식별자 역할 수행
- 저장된 속성을 기반으로 향후 제품 비교, 그룹핑, 분석 등에 활용 가능
- 기존 경쟁사 필터링 로직과 자연스럽게 연동

## 제품 속성 필드 정의

### Product 모델 확장 필드
| 필드명 | 타입 | 설명 | 예시 |
|--------|------|------|------|
| `brand` | String(100), nullable | 브랜드명 | "삼성", "LG", "나이키" |
| `maker` | String(100), nullable | 제조사명 | "삼성전자", "LG전자" |
| `series` | String(100), nullable | 시리즈/라인 | "갤럭시 S25", "에어맥스" |
| `capacity` | String(50), nullable | 용량/규격 | "1TB", "500ml", "100매" |
| `color` | String(50), nullable | 색상 | "블랙", "화이트" |
| `material` | String(50), nullable | 소재 | "스테인리스", "가죽" |
| `product_attributes` | JSON, nullable | 추가 속성 (key-value) | {"사이즈": "XL", "등급": "1등급"} |

### 설계 원칙
- **자주 쓰는 속성은 정규 컬럼**: brand, maker, series, capacity, color, material → 검색/필터링 가능
- **비정형 속성은 JSON**: product_attributes → 제품마다 다른 속성을 유연하게 저장
- **기존 `model_code`**: 그대로 유지, 고유 식별자 역할 강화
- **기존 `spec_keywords`**: 그대로 유지, 경쟁사 필터링 + 키워드 검색용

## 변경 범위

### 1. DB 모델 변경 (`models/product.py`)
- Product 클래스에 6개 필드 추가: brand, maker, series, capacity, color, material, product_attributes
- `main.py` lifespan에 ALTER TABLE 마이그레이션 추가

### 2. Pydantic 스키마 변경 (`schemas/product.py`)
- `ProductCreate`: 7개 필드 추가 (모두 Optional)
- `ProductUpdate`: 7개 필드 추가 (모두 Optional)
- `ProductResponse` / `ProductDetail` / `ProductListItem`: 7개 필드 추가

### 3. API 변경
- `POST /users/{user_id}/products`: 새 필드 수신 및 저장
- `PUT /products/{id}`: 새 필드 수정
- `GET /products/{id}`: 새 필드 응답에 포함
- `GET /users/{user_id}/products`: 목록 응답에 새 필드 포함

### 4. 스토어 상품 불러오기 연동 (`store_import.py`, `store_scraper.py`)
- 네이버 API에서 brand, maker 이미 가져오고 있음 → Product에 자동 저장
- `StoreImportItem` 스키마에 brand, maker 이미 존재 → import 시 Product에 매핑

### 5. SEO 키워드 엔진 연동 (선택)
- 상품 등록/수정 시 `product_name`을 키워드 엔진으로 파싱하여 속성 자동 추출 제안
- 자동 채움(auto-fill)은 프론트엔드에서 호출 (기존 `POST /keywords/suggest` 활용 가능)

### 6. 프론트엔드 (Codex 담당)
- 상품 등록/수정 폼에 제품 속성 입력 UI 추가
- 상품 상세 페이지에 제품 속성 표시 섹션
- (선택) 상품명 입력 시 속성 자동 추출 제안 UI

## 기존 데이터 호환성
- 모든 새 필드가 nullable → 기존 상품 데이터 영향 없음
- 기존 `model_code`, `spec_keywords` 로직 변경 없음
- 스토어 import 시 brand, maker 자동 매핑으로 기존 데이터 보강 가능

## 구현 순서
1. `Product` 모델에 7개 필드 추가
2. `main.py` ALTER TABLE 마이그레이션 추가
3. `ProductCreate`, `ProductUpdate` 스키마에 필드 추가
4. `ProductResponse`, `ProductDetail`, `ProductListItem` 스키마에 필드 추가
5. `store_import.py`에서 import 시 brand, maker를 Product에 저장
6. CLAUDE.md API 명세 업데이트

## 수정 파일 목록 (백엔드 6개)
| 파일 | 변경 내용 |
|------|----------|
| `models/product.py` | 7개 필드 추가 |
| `schemas/product.py` | Create/Update/Response/Detail/ListItem에 필드 추가 |
| `api/store_import.py` | import 시 brand, maker 저장 |
| `main.py` | ALTER TABLE 마이그레이션 |
| `CLAUDE.md` | API 명세 업데이트 |

## 리스크
- **데이터 입력 부담**: 필드가 많아지면 등록이 번거로울 수 있음 → 모두 Optional + 자동 추출 제안으로 완화
- **JSON 필드 검색 성능**: `product_attributes`는 PostgreSQL JSON 쿼리가 일반 컬럼보다 느림 → 자주 검색하는 속성은 정규 컬럼 사용
- **모델코드 유일성**: model_code를 unique constraint로 잡지는 않음 (같은 모델을 키워드 다르게 등록 가능)
