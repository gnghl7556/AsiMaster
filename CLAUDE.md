# AsiMaster - 네이버 쇼핑 가격 모니터링 시스템

## 프로젝트 개요
네이버 쇼핑에서 내 상품의 경쟁사 가격/순위를 모니터링하는 개인용 도구.
키워드 기반으로 상위 10개 상품의 가격, 순위, 판매자를 자동 수집.

## 기술 스택
- **Backend**: FastAPI + SQLAlchemy (async) + PostgreSQL (asyncpg)
- **Frontend**: Next.js 15 (App Router) + React 19 + TailwindCSS 4 + Tanstack Query
- **DB**: Railway PostgreSQL
- **배포**: Railway (backend: Docker), Vercel (frontend)
- **크롤링**: 네이버 쇼핑 검색 API (openapi.naver.com)

## 디렉토리 구조
```
asimaster/
  backend/          # FastAPI (Python 3.11)
    app/
      api/          # 라우터 (users, products, keywords, crawl, costs, alerts, etc)
      core/         # config.py, database.py, deps.py
      crawlers/     # naver.py (네이버 API 크롤러), manager.py
      models/       # SQLAlchemy 모델
      schemas/      # Pydantic 스키마
      services/     # 비즈니스 로직 (product_service, alert_service, margin_service)
      scheduler/    # APScheduler 크롤링 스케줄러
    Dockerfile
    railway.toml
    requirements.txt
  frontend/         # Next.js 15 (TypeScript)
    src/
      app/          # 페이지 (products, dashboard, alerts, settings)
      components/   # UI 컴포넌트 (products, dashboard, alerts, settings, ui, layout)
      lib/          # API 클라이언트, hooks, utils
      stores/       # Zustand 스토어
      types/        # TypeScript 타입 정의
```

## 환경변수 (.env - gitignore됨)
### backend/.env
```
DATABASE_URL=postgresql+asyncpg://...@crossover.proxy.rlwy.net:38339/railway
NAVER_CLIENT_ID=<네이버 개발자센터 Client ID>
NAVER_CLIENT_SECRET=<네이버 개발자센터 Client Secret>
CORS_ORIGINS=["http://localhost:3000","https://<vercel-domain>"]
```

### frontend/.env.local
```
NEXT_PUBLIC_API_URL=https://<railway-backend-domain>/api/v1
```

## 로컬 실행
```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --port 8000

# Frontend
cd frontend
npm install
npm run dev
```

## 핵심 API 엔드포인트
- `POST /api/v1/users` - 사업체 등록
- `PUT /api/v1/users/{id}` - 사업체 수정 (naver_store_name, crawl_interval_min 설정)
- `GET /api/v1/users/{user_id}/products` - 상품 목록
- `POST /api/v1/users/{user_id}/products` - 상품 등록 (자동 키워드 등록)
- `GET /api/v1/products/{id}` - 상품 상세 (키워드별 순위 포함)
- `PUT /api/v1/products/{id}` - 상품 수정
- `DELETE /api/v1/products/{id}` - 상품 삭제
- `POST /api/v1/users/{user_id}/products/bulk-delete` - 상품 복수 삭제
- `PATCH /api/v1/products/{id}/price-lock` - 가격고정 토글
- `GET /api/v1/products/{id}/excluded` - 블랙리스트 조회
- `POST /api/v1/products/{id}/excluded` - 블랙리스트 추가
- `DELETE /api/v1/products/{id}/excluded/{naver_product_id}` - 블랙리스트 해제
- `POST /api/v1/crawl/product/{id}` - 상품 크롤링 실행
- `POST /api/v1/keywords/{product_id}` - 키워드 추가
- `POST /api/v1/keywords/suggest` - SEO 기반 키워드 추천
- `GET /api/v1/dashboard/{user_id}` - 대시보드 요약
- `GET /api/v1/push/vapid-public-key` - VAPID 공개키 조회
- `POST /api/v1/push/subscribe` - 웹 푸시 구독 등록
- `DELETE /api/v1/push/subscribe` - 웹 푸시 구독 해제
- `GET /api/v1/users/{user_id}/store/products?store_url=...` - 스마트스토어 상품 미리보기 (스크래핑)
- `POST /api/v1/users/{user_id}/store/import` - 선택한 상품 일괄 등록
- `GET /api/v1/naver-categories` - 크롤링 데이터 기반 네이버 카테고리 트리

## 핵심 모델 관계
User → Products → SearchKeywords → KeywordRankings
                                  → CrawlLogs
               → ExcludedProducts (블랙리스트)
User → Alerts, AlertSettings
Product → CostItems

## 현재 완료된 기능
1. 사업체(User) CRUD + 네이버 스토어명 설정
2. 상품 CRUD + 카테고리 드롭다운 + 마진 미리보기
3. 키워드 기반 네이버 쇼핑 API 크롤링 (상위 10개)
4. 키워드별 경쟁사 순위 표시 + 내 스토어 하이라이트
5. 가격고정 토글 + 마진 시뮬레이션
6. 알림 시스템 (최저가 이탈, 순위 하락)
7. 대시보드 (요약, 가격 추이, 순위 차트)
8. 비용 프리셋 관리
9. 상품 삭제 (확인 모달)
10. 크롤링 성능 개선 (연결 풀링, 병렬 크롤링, 키워드 중복 제거)
11. 상품 관련성 필터링 (model_code + spec_keywords 기반 is_relevant)
12. 경쟁사 블랙리스트 (naver_product_id 기반 제외)
13. 스마트스토어 상품 자동 불러오기 (URL 입력 → 미리보기 → 선택 등록)
14. 네이버 API 전체 필드 저장 (hprice, brand, maker, productType, category1~4)
15. 네이버 카테고리 트리 API (크롤링 데이터 기반 계층 구조)
16. SEO 키워드 엔진 (토큰 분류 + 가중치 기반 키워드 추천 API)

## 디자인 시스템
- Glassmorphism (`glass-card` 클래스)
- 상태 색상: winning(emerald), close(amber), losing(red)
- 다크모드 지원 (CSS 변수 기반)
- Pretendard 폰트
- lucide-react 아이콘

## 주의사항
- Railway DB public URL 사용 (internal URL은 로컬에서 접근 불가)
- crawl_logs 테이블은 수동 마이그레이션 완료 (keyword_id 컬럼)
- create_all로 테이블 자동 생성, ALTER TABLE은 main.py lifespan에서 처리
- `.env` 파일은 gitignore됨 - 새 환경에서 직접 설정 필요

## AI 에이전트 협업 가이드

### 역할 분담
- **Claude Code**: `backend/` 폴더 전담. FastAPI, DB 모델링, 비즈니스 로직, 크롤링 엔진 구축 담당. (`frontend/` 폴더는 절대 수정하지 않음)
- **Codex (Editor AI)**: `frontend/` 폴더 전담. Next.js 화면 구현, 컴포넌트 리팩토링 및 API 연동 담당.

### 작업 동기화 규칙
- **API 명세 기록**: Claude가 백엔드 API를 추가/수정하면, 반드시 이 문서(CLAUDE.md)의 API 엔드포인트 섹션에 변경된 Request/Response 구조를 명확히 기록한다.
- Codex는 이 문서에 기록된 최신 API 명세를 바탕으로 프론트엔드 연동 작업을 수행한다.

## API 변경 이력

### 2026-02-21: 상품 naver_product_id 매칭 + 자기 상품 자동 제외
- `Product` 모델에 `naver_product_id` 필드 추가 (네이버 쇼핑 고유 상품번호)
- 스토어 상품 불러오기 시 `naver_product_id` 자동 저장
- `ProductCreate`, `ProductUpdate` 스키마에 `naver_product_id` 필드 추가
- `StoreImportItem`에 `naver_product_id` 필드 추가
- 크롤링 시 검색 결과의 `naver_product_id`가 모니터링 상품과 동일하면 `is_relevant=false` 자동 처리
- 내 스토어의 **다른** 상품은 경쟁 목록에 정상 표시 (Ban도 가능)

### 2026-02-21: 상품 복수 삭제 + 크롤링 주기 설정 수정
- `POST /api/v1/users/{user_id}/products/bulk-delete` — 상품 복수 삭제
  - Request: `{ product_ids: [1, 2, 3] }` (최소 1개)
  - Response: `{ deleted: 2 }` (실제 삭제된 건수)
  - user_id 소속 상품만 삭제, 존재하지 않는 ID는 무시
- `PUT /api/v1/users/{user_id}` 에서 `crawl_interval_min` 값이 실제 반영되지 않던 버그 수정

### 2026-02-21: 상품 API 경로 정리 (R8)
**변경된 API 경로 4개** (user_id 제거):
| 기존 | 변경 후 |
|------|---------|
| `GET /api/v1/users/{user_id}/products/{product_id}` | `GET /api/v1/products/{product_id}` |
| `PUT /api/v1/users/{user_id}/products/{product_id}` | `PUT /api/v1/products/{product_id}` |
| `DELETE /api/v1/users/{user_id}/products/{product_id}` | `DELETE /api/v1/products/{product_id}` |
| `PATCH /api/v1/users/{user_id}/products/{product_id}/price-lock` | `PATCH /api/v1/products/{product_id}/price-lock` |

**유지되는 API 경로** (변경 없음):
- `GET /api/v1/users/{user_id}/products` (목록)
- `POST /api/v1/users/{user_id}/products` (생성)

### 2026-02-21: 유저별 크롤링 주기 (R4)
- `UserResponse`에 `crawl_interval_min: int` 필드 추가 (기본값 60분)
- `UserUpdate`에 `crawl_interval_min: int | None` 필드 추가 (0~1440, 0=크롤링 중지)

### 2026-02-21: 크롤링 성능 + 정확도 개선
**새 기능:**
- `Product`에 `model_code` (모델 코드), `spec_keywords` (규격 키워드 배열) 필드 추가
- `KeywordRanking`에 `naver_product_id`, `is_relevant` 필드 추가
- 블랙리스트 API: `GET/POST /products/{id}/excluded`, `DELETE /products/{id}/excluded/{naver_product_id}`
- 크롤링 시 모델코드+규격 키워드 매칭으로 관련 상품 자동 필터링
- 블랙리스트된 naver_product_id 자동 제외
- 최저가/sparkline 계산이 관련 상품(`is_relevant=true`)만 기준으로 동작
- `CompetitorSummary`에 `naver_product_id`, `is_relevant` 필드 추가
- `RankingItemResponse`에 `naver_product_id`, `is_relevant` 필드 추가
- 크롤링 상태 API에 `avg_duration_ms` 필드 추가
- httpx 연결 풀링, Semaphore 기반 병렬 크롤링, 유저 전체 크롤링 시 키워드 중복 제거

### 2026-02-21: 백엔드 최종 마무리 (R1, R2, R5, R6)
- **R1 정렬/페이지네이션**: `GET /users/{user_id}/products`에 `page`, `limit` 쿼리 파라미터 추가. `rank_drop` 정렬이 실제 순위 변동 기반으로 동작. `ProductListItem`에 `rank_change` 필드 추가.
- **R2 상품 상세 보강**: `ProductDetail`에 `user_id`, `rank_change`, `keyword_count`, `sparkline`, `competitors` 필드 추가.
- **R5 크롤링 딜레이**: 키워드 간 크롤링에 `CRAWL_REQUEST_DELAY_MIN`~`MAX` 랜덤 딜레이 적용.
- **R6 웹 푸시 뼈대**: `push_subscriptions` 테이블 추가. `GET /push/vapid-public-key`, `POST /push/subscribe`, `DELETE /push/subscribe` 엔드포인트 추가. 알림 생성 시 자동 웹 푸시 전송.

### 2026-02-21: 키워드별 정렬 유형 (노출 순위 / 가격 순위)
- `SearchKeyword`에 `sort_type` 필드 추가 (`"sim"` = 노출 순위, `"asc"` = 가격 순위, 기본값: `"sim"`)
- `POST /products/{product_id}/keywords`: `sort_type` 필드 추가 (`"sim"` | `"asc"`, 기본값: `"sim"`)
- `GET /products/{product_id}/keywords`: 응답에 `sort_type` 필드 포함
- 상품 상세 API (`GET /products/{id}`) keywords 배열에 `sort_type` 필드 포함
- 크롤링 시 키워드별 `sort_type`에 맞는 네이버 API sort 파라미터 동적 적용
- 유저 전체 크롤링 시 중복 제거 키가 `(keyword, sort_type)` 기준으로 동작

### 2026-02-21: 스마트스토어 상품 자동 불러오기
**새 API:**
- `GET /api/v1/users/{user_id}/store/products?store_url=<URL>` — 스토어 상품 미리보기
  - Response: `[{name, price, image_url, category, naver_product_id, suggested_keywords}]`
  - `suggested_keywords`: 상품명에서 자동 추출된 추천 키워드 최대 5개
  - 스마트스토어 URL 입력 → 페이지 스크래핑(channelName 추출) → 네이버 쇼핑 API로 상품 검색
- `POST /api/v1/users/{user_id}/store/import` — 선택한 상품 일괄 등록
  - Request: `{products: [{name, selling_price, image_url?, category?, keywords?}]}`
  - `keywords`: 사용자가 선택한 키워드 배열 (미전달 시 상품명이 기본 키워드로 등록)
  - Response: `{created, skipped, skipped_names}`
  - 중복 상품(같은 이름) 자동 스킵, 첫 번째 키워드가 is_primary=true로 등록

**새 파일:**
- `backend/app/crawlers/store_scraper.py` — 스마트스토어 페이지 스크래핑 + 네이버 쇼핑 API 검색
- `backend/app/schemas/store_import.py` — StoreProductItem, StoreImportRequest, StoreImportResult
- `backend/app/api/store_import.py` — 미리보기/등록 엔드포인트

### 2026-02-22: Naver API 전체 필드 저장 + 카테고리 트리 API
**KeywordRanking 모델 확장 (8개 필드 추가):**
- `hprice` (INTEGER, 기본값 0): 최고가
- `brand` (VARCHAR(200)): 브랜드명
- `maker` (VARCHAR(200)): 제조사명
- `product_type` (VARCHAR(10)): 상품 구분 (1=일반, 2=중고, 3=리퍼 등)
- `category1~4` (VARCHAR(100)): 네이버 카테고리 1~4단계

**스키마 변경:**
- `RankingItemResponse`에 hprice, brand, maker, product_type, category1~4 필드 추가
- `KeywordWithRankings`에 `sort_type` 필드 추가 (기존 누락)
- `CompetitorSummary`에 hprice, brand, maker 필드 추가
- `StoreProductItem`에 brand, maker 필드 추가

**새 API:**
- `GET /api/v1/naver-categories` — 크롤링 데이터 기반 네이버 카테고리 트리
  - Response: `{categories: [{name, product_count, children: [...]}], total_paths}`
  - keyword_rankings 테이블에서 DISTINCT (category1~4) GROUP BY 집계
  - product_count 내림차순 정렬

**크롤링 변경:**
- 네이버 쇼핑 API 응답에서 hprice, brand, maker, productType, category1~4 추출 및 DB 저장
- 스토어 상품 불러오기에서 brand, maker 추출 및 프리뷰 응답에 포함

**새 파일:**
- `backend/app/api/categories.py` — 카테고리 트리 엔드포인트

### 2026-02-23: SEO 키워드 엔진 + 보안 강화 + 메모리 최적화

**보안 강화:**
- `config.py`: 사용하지 않던 `ALLOWED_HOSTS` 필드 삭제
- `config.py`: VAPID 키 쌍 일관성 검증 (하나만 설정 시 경고 로그)
- `store_scraper.py`: slug 길이 제한 50자, `channel_name` 위험문자(`<>"';&`) 필터링
- `store_import.py`: `store_url` 파라미터 `max_length=500` 추가
- `schemas/store_import.py`: `StoreImportRequest.products` `max_length=100` 추가

**메모리 최적화:**
- `product_service.py`: `selectinload(SearchKeyword.rankings)` 제거
- 별도 DB 쿼리로 최신 rankings / 7일 sparkline(DB GROUP BY) / rank_change만 조회
- 상품 50개 기준 메모리 사용량 대폭 감소 (25,000행 → ~500행)

**새 API:**
- `POST /api/v1/keywords/suggest` — SEO 기반 키워드 추천
  - Request: `{ product_name: str, store_name?: str, category_hint?: str }`
  - Response: `{ tokens: [{text, category, weight}], keywords: [{keyword, score, level}], field_guide: {brand?, category?} }`
  - 토큰 분류: 11종 (MODEL, BRAND, TYPE, SERIES, CAPACITY, QUANTITY, SIZE, COLOR, MATERIAL, FEATURE, MODIFIER)
  - 키워드 생성: specific(MODEL 포함), medium(BRAND+TYPE), broad 조합
  - DB 사전: keyword_rankings의 brand/maker → BRAND, category1~4 → TYPE (24시간 캐시)

**새 패키지:**
- `backend/app/services/keyword_engine/` — SEO 키워드 엔진
  - `classifier.py` — 토큰 분류기 (정규식 → 내장사전 → DB사전 3단계)
  - `weights.py` — SEO 가중치
  - `generator.py` — 키워드 조합 생성기
  - `dictionary.py` — DB 기반 브랜드/카테고리 사전 (TTL 24h)
- `backend/app/schemas/keyword_suggest.py` — 키워드 추천 스키마

**변경된 파일:**
- `store_scraper.py`: `suggest_keywords()` 내부를 키워드 엔진 분류기 기반으로 교체
