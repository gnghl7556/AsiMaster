# AsiMaster - 네이버 쇼핑 가격 모니터링 시스템

## 프로젝트 개요
네이버 쇼핑에서 내 상품의 경쟁사 가격/순위를 모니터링하는 개인용 도구.
키워드 기반으로 상위 10개 상품의 가격, 순위, 판매자를 자동 수집.

## 기술 스택
- **Backend**: FastAPI + SQLAlchemy (async) + PostgreSQL (asyncpg)
- **Frontend**: Next.js 15 (App Router) + React 19 + TailwindCSS 4 + Tanstack Query
- **DB**: Railway PostgreSQL
- **마이그레이션**: Alembic (async)
- **배포**: Railway (backend: Docker), Vercel (frontend)
- **크롤링**: 네이버 쇼핑 검색 API (openapi.naver.com)
- **모니터링**: Sentry (에러 추적), 구조화 JSON 로깅 (python-json-logger)
- **테스트**: pytest + pytest-asyncio + SQLite in-memory

## 디렉토리 구조
```
asimaster/
  backend/          # FastAPI (Python 3.11)
    app/
      api/          # 라우터 (users, products, keywords, crawl, costs, alerts, etc)
      core/         # config.py, database.py, deps.py, logging.py
      crawlers/     # naver.py (네이버 API 크롤러), manager.py
      models/       # SQLAlchemy 모델
      schemas/      # Pydantic 스키마
      services/     # 비즈니스 로직 (product_service, alert_service, cost_service, etc)
      scheduler/    # APScheduler 크롤링 스케줄러
    migrations/     # Alembic 마이그레이션
    scripts/        # export_openapi.py (OpenAPI spec 내보내기)
    tests/          # pytest 통합 테스트
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

# 선택적 설정 (기본값 있음)
SENTRY_DSN=                          # 비어있으면 Sentry 비활성화
SENTRY_TRACES_SAMPLE_RATE=0.1        # 트레이스 샘플링 비율
LOG_FORMAT=json                      # "json" (프로덕션) | "text" (로컬 개발)
LOG_LEVEL=INFO
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

# 테스트
cd backend
python -m pytest tests/ -v

# 마이그레이션
cd backend
alembic revision --autogenerate -m "description"   # 마이그레이션 파일 생성
alembic upgrade head                                # 적용

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
- `PUT /api/v1/cost-presets/{id}` - 비용 프리셋 수정
- `POST /api/v1/cost-presets/{id}/apply` - 복수 상품에 프리셋 중첩 적용
- `POST /api/v1/cost-presets/{id}/detach` - 프리셋 해제 (해당 항목만 삭제)
- `GET /api/v1/products/{id}/included` - 수동 포함 예외 조회
- `POST /api/v1/products/{id}/included` - 수동 포함 예외 추가
- `DELETE /api/v1/products/{id}/included/{naver_product_id}` - 수동 포함 예외 해제

## 핵심 모델 관계
User → Products → SearchKeywords → KeywordRankings
                                  → CrawlLogs
               → ExcludedProducts (블랙리스트)
               → IncludedOverrides (수동 포함 예외)
User → Alerts, AlertSettings
User → CostPresets
Product → CostItems → CostItem.source_preset_id (프리셋 출처, 중첩 적용)

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
17. 배송비 포함 가격 비교 (스마트스토어 배송비 스크래핑 + 총액 기준 최저가)
18. 상품 DB화 (모델명 기반 제품 속성 구조화: brand, maker, series, capacity, color, material, product_attributes)
19. 비용 프리셋 중첩 적용 (CostItem.source_preset_id로 출처 추적, 서로 다른 프리셋 동시 적용, 동일 프리셋 중복 방지)
20. 수동 포함 예외 (자동 필터 우회: included_overrides 테이블 + relevance_reason 추적)
21. OpenAPI → TypeScript 타입 자동 동기화 (openapi.json + GitHub Action + openapi-typescript)
22. Alembic 마이그레이션 (수동 ALTER TABLE 130줄 → Alembic async 프레임워크)
23. Sentry 에러 추적 (SENTRY_DSN 설정 시 자동 활성화)
24. 구조화 JSON 로깅 (LOG_FORMAT=json/text 전환 가능)
25. pytest 통합 테스트 (14개: 비즈니스 로직 9 + API 5, SQLite in-memory)
26. 크롤링 메트릭스 (/health에 24시간 크롤링 통계 포함)
27. 서비스 레이어 분리 (category_service, cost_service, price_service — thin controller 패턴)

## 디자인 시스템
- Glassmorphism (`glass-card` 클래스)
- 상태 색상: winning(emerald), close(amber), losing(red)
- 다크모드 지원 (CSS 변수 기반)
- Pretendard 폰트
- lucide-react 아이콘

## 주의사항
- Railway DB public URL 사용 (internal URL은 로컬에서 접근 불가)
- DB 스키마 변경은 **Alembic 마이그레이션**으로 관리 (main.py의 수동 ALTER TABLE 제거됨)
- `Base.metadata.create_all`은 새 테이블 초기 생성용 fallback으로만 유지
- `.env` 파일은 gitignore됨 - 새 환경에서 직접 설정 필요
- `SENTRY_DSN` 미설정 시 Sentry 비활성화 (프로덕션 전용)
- `LOG_FORMAT=text`로 로컬 개발 시 가독성 좋은 텍스트 로그 출력

## config.py 설정 일람
모든 매직넘버가 `config.py`의 `Settings` 클래스로 통합됨 (환경변수로 오버라이드 가능):

| 설정 | 기본값 | 설명 |
|------|--------|------|
| `CRAWL_DEFAULT_INTERVAL_MIN` | 60 | 기본 크롤링 주기 (분) |
| `CRAWL_MAX_RETRIES` | 3 | 크롤링 재시도 횟수 |
| `CRAWL_REQUEST_DELAY_MIN/MAX` | 2/5 | 키워드 간 크롤링 딜레이 (초) |
| `CRAWL_CONCURRENCY` | 5 | 병렬 크롤링 동시 실행 수 |
| `CRAWL_SHIPPING_CONCURRENCY` | 3 | 배송비 스크래핑 동시 실행 수 |
| `CRAWL_SHIPPING_TIMEOUT` | 8 | 배송비 스크래핑 타임아웃 (초) |
| `CRAWL_API_TIMEOUT` | 10 | 네이버 API 클라이언트 타임아웃 (초) |
| `SCHEDULER_CHECK_INTERVAL_MIN` | 10 | 스케줄러 체크 주기 (분) |
| `DATA_RETENTION_DAYS` | 30 | 오래된 데이터 보존 기간 (일) |
| `CLEANUP_BATCH_SIZE` | 10000 | 데이터 정리 배치 크기 |
| `ALERT_DEDUP_HOURS` | 24 | 알림 중복 방지 기간 (시간) |
| `SPARKLINE_DAYS` | 7 | 스파크라인/순위변동 조회 기간 (일) |
| `MAX_KEYWORDS_PER_PRODUCT` | 5 | 상품당 최대 키워드 수 |

## AI 에이전트 협업 가이드

### 역할 분담
- **Claude Code**: `backend/` 폴더 전담. FastAPI, DB 모델링, 비즈니스 로직, 크롤링 엔진 구축 담당. (`frontend/` 폴더는 절대 수정하지 않음)
- **Codex (Editor AI)**: `frontend/` 폴더 전담. Next.js 화면 구현, 컴포넌트 리팩토링 및 API 연동 담당.

### 작업 동기화 규칙
- **API 명세 기록**: Claude가 백엔드 API를 추가/수정하면, 반드시 이 문서(CLAUDE.md)의 API 엔드포인트 섹션에 변경된 Request/Response 구조를 명확히 기록한다.
- Codex는 이 문서에 기록된 최신 API 명세를 바탕으로 프론트엔드 연동 작업을 수행한다.

### OpenAPI → TypeScript 타입 자동 동기화
백엔드 Pydantic 스키마 → `openapi.json` → 프론트엔드 TypeScript 타입 자동 생성 파이프라인:

**Claude Code (백엔드 변경 후):**
```bash
cd backend && ./venv/bin/python3 -m scripts.export_openapi
# → 프로젝트 루트 openapi.json 갱신
# → openapi.json을 백엔드 변경과 함께 커밋
```

**Codex (프론트엔드):**
```bash
cd frontend && npm run generate-types
# → src/types/api.generated.ts 자동 생성
# → src/types/index.ts (re-export 레이어)에서 타입 매핑
```

**파일 구조:**
- `backend/scripts/export_openapi.py` — OpenAPI spec 내보내기 스크립트
- `openapi.json` (프로젝트 루트) — 공유 API 명세 (git 커밋)
- `frontend/src/types/api.generated.ts` — 자동 생성 타입 (openapi-typescript)
- `frontend/src/types/index.ts` — re-export 레이어 (안정 타입명 유지)
- `.github/workflows/sync-types.yml` — GitHub Action (openapi.json 변경 시 자동 PR 생성)

**자동화 흐름:**
1. Claude Code가 `openapi.json` 포함하여 push
2. GitHub Action이 `npm run generate-types` 실행
3. 타입 변경이 있으면 자동 PR 생성 (branch: `auto/sync-types-*`)
4. Codex는 해당 PR을 기반으로 프론트엔드 수정

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

### 2026-02-24: 배송비 포함 가격 비교 (Shipping Fee Integration)

**KeywordRanking 모델 확장:**
- `shipping_fee` (INTEGER, 기본값 0): 배송비

**크롤링 변경:**
- 네이버 쇼핑 API 검색 후, 스마트스토어 상품(`smartstore.naver.com`, `brand.naver.com`)의 배송비를 페이지 스크래핑으로 추출
- `__PRELOADED_STATE__` JSON에서 delivery.deliveryFee.baseFee 추출
- 비스마트스토어(옥션, 11번가 등)는 `shipping_fee=0` 기본값
- Semaphore(3)으로 동시 배송비 스크래핑 제한, 실패 시 graceful fallback(0)

**가격 비교 로직 변경:**
- `lowest_price`: 기존 상품가격만 → **배송비 포함 총액** (`price + shipping_fee`)
- `sparkline`: 일별 최저가가 **배송비 포함 총액** 기준
- `price_gap`, `price_gap_percent`: 총액 기준으로 자동 반영
- `status` (winning/close/losing): 총액 기준으로 자동 반영

**스키마 변경:**
- `RankingItemResponse`에 `shipping_fee: int = 0` 필드 추가
- `CompetitorSummary`에 `shipping_fee: int = 0` 필드 추가
- 상품 상세 API keywords[].rankings[]에 `shipping_fee` 필드 포함

### 2026-02-24: 가격 범위 필터 (Price Range Filter)

**Product 모델 확장:**
- `price_filter_min_pct` (INTEGER, nullable): 최소 가격 필터 (판매가의 N%, 0~100)
- `price_filter_max_pct` (INTEGER, nullable): 최대 가격 필터 (판매가의 N%, 100~)

**크롤링 관련성 판별 변경:**
- `_check_relevance()` 함수에 가격 범위 체크 추가 (기존 model_code + spec_keywords 필터와 AND 조건)
- 배송비 포함 총액(`price + shipping_fee`) 기준으로 비교
- 예: 판매가 50,000원, min_pct=30 → 15,000원 미만 상품 자동 `is_relevant=false`
- 필터 미설정(null) 시 기존 동작 유지 (하위 호환)

**스키마 변경:**
- `ProductCreate`, `ProductUpdate`에 `price_filter_min_pct`, `price_filter_max_pct` 추가
- `ProductResponse`, `ProductDetail`에 두 필드 추가

### 2026-02-25: 배송비 추출 실패 vs 무료배송 구분 (shipping_fee_type)

**KeywordRanking 모델 확장:**
- `shipping_fee_type` (VARCHAR(20), 기본값 `"unknown"`): 배송비 타입 (`paid` | `free` | `unknown` | `error`)

**크롤링 변경:**
- `_fetch_shipping_fee()` 반환값: `int` → `tuple[int, str]` (fee, type)
- 오류 페이지 감지: `<title>`에 `에러` 포함 시 `(0, "error")` 반환
- `error` 결과에 1회 재시도 (200~400ms 딜레이)
- 캐시 오염 방지: `paid`/`free`만 캐시 저장, `error`/`unknown`은 미저장 (다음 키워드에서 재시도)
- 키워드별 배송비 타입 집계 로그 (paid/free/unknown/error 카운트)

**스키마 변경:**
- `RankingItemResponse`에 `shipping_fee_type: str = "unknown"` 필드 추가
- `CompetitorSummary`에 `shipping_fee_type: str = "unknown"` 필드 추가
- 상품 상세 API keywords[].rankings[] 및 competitors[]에 `shipping_fee_type` 필드 포함

**하위호환:**
- `shipping_fee: int` 유지 → 기존 프론트 정상 동작
- `shipping_fee_type` 새 필드 → 기존 프론트가 무시해도 OK
- 기존 DB 데이터: default `"unknown"` 자동 적용

### 2026-02-26: 상품 DB화 (모델명 기반 제품 속성 구조화)

**Product 모델 확장 (7개 필드):**
- `brand` (VARCHAR(100), nullable): 브랜드명
- `maker` (VARCHAR(100), nullable): 제조사명
- `series` (VARCHAR(100), nullable): 시리즈/라인명
- `capacity` (VARCHAR(50), nullable): 용량/규격
- `color` (VARCHAR(50), nullable): 색상
- `material` (VARCHAR(50), nullable): 소재
- `product_attributes` (JSONB, nullable): 추가 비정형 속성 (key-value)

**스키마 변경:**
- `ProductCreate`, `ProductUpdate`에 7개 필드 추가 (모두 Optional)
- `ProductResponse`, `ProductDetail`에 7개 필드 추가
- `ProductListItem`에 `model_code`, `brand` 필드 추가
- `StoreImportItem`에 `brand`, `maker` 필드 추가 (import 시 자동 저장)

**하위호환:**
- 모든 필드 nullable, 기본값 NULL → 기존 상품 데이터 영향 없음

### 2026-02-26: 비용 프리셋 중첩 적용 (아키텍처 재설계)

**설계 변경 (Breaking Change):**
- `Product.cost_preset_id` (단일 FK) **삭제** → `CostItem.source_preset_id` (출처 추적) **추가**
- 상품 1개에 서로 다른 프리셋 여러 개 동시 적용 가능, 동일 프리셋 중복 적용은 방지
- `cost_preset_id: int | None` → `cost_preset_ids: list[int] = []` (ProductResponse, ProductListItem, ProductDetail)

**CostItem 모델 확장:**
- `source_preset_id` (INTEGER, FK → cost_presets.id, ON DELETE SET NULL, nullable): 프리셋 출처
  - NULL = 수동 입력 항목, N = 프리셋 N에서 온 항목
- 복합 인덱스 `(product_id, source_preset_id)` 추가

**Product 모델 변경:**
- `cost_preset_id` 컬럼 + FK **제거** (CostItem에서 DISTINCT 조회로 대체)

**새 API:**
- `POST /api/v1/cost-presets/{preset_id}/detach` — 프리셋 해제 (해당 프리셋 항목만 삭제)
  - Request: `{ product_ids: [1, 2, 3] }` (최소 1개, 최대 100개)
  - Response: `{ detached: 2, skipped: 1 }`
  - 수동 항목 + 다른 프리셋 항목은 유지

**기존 API 변경:**
- `POST /cost-presets/{id}/apply`: 전체 교체 → **중첩 추가** (동일 프리셋 이미 적용 시 skip)
  - Response에 `skipped_reason: str | null` 필드 추가
- `PUT /products/{id}/costs`: 수동 항목(source_preset_id=NULL)만 삭제/재생성 (프리셋 항목 유지)
- `DELETE /cost-presets/{id}`: FK SET NULL로 CostItem 자동 수동 항목 전환

**스키마 변경:**
- `CostItemResponse`에 `source_preset_id: int | None` 필드 추가
- `CostPresetApplyResponse`에 `skipped_reason: str | None` 필드 추가
- `CostPresetDetachRequest`, `CostPresetDetachResponse` 신규 추가

**서비스 변경 (cost_service.py):**
- `apply_preset_to_products`: additive (기존 항목 유지, 새 프리셋 항목 추가)
- `detach_preset_from_products`: 특정 프리셋 항목만 삭제
- `get_applied_preset_ids`, `get_applied_preset_ids_batch`: DISTINCT source_preset_id 조회

**product_service.py 변경:**
- `get_product_list_items()`: 배치 쿼리로 `cost_preset_ids` 배열 조회
- `get_product_detail()`: `get_applied_preset_ids()` 호출

### 2026-02-26: 수동 포함 예외 (Include Override)

**새 테이블: `included_overrides`**
- `id` (PK), `product_id` (FK → products.id, CASCADE), `naver_product_id` (VARCHAR(50))
- `naver_product_name` (VARCHAR(500), nullable), `mall_name` (VARCHAR(200), nullable), `created_at`
- Unique constraint: `(product_id, naver_product_id)`

**새 API:**
- `GET /api/v1/products/{product_id}/included` — 수동 포함 예외 목록 조회
  - Response: `[{id, naver_product_id, naver_product_name, mall_name, created_at}]`

- `POST /api/v1/products/{product_id}/included` — 수동 포함 예외 추가
  - Request: `{ naver_product_id: str, naver_product_name?: str, mall_name?: str }`
  - Response: `{id, naver_product_id, naver_product_name, mall_name, created_at}` (201)
  - 중복 시 409, 즉시 반영: 해당 naver_product_id의 기존 rankings → is_relevant=True

- `DELETE /api/v1/products/{product_id}/included/{naver_product_id}` — 수동 포함 예외 해제
  - 204, 기존 rankings는 다음 크롤링에서 재판정

**KeywordRanking 모델 확장:**
- `relevance_reason` (VARCHAR(30), nullable): 관련성 판정 사유

**is_relevant 판정 우선순위 (크롤링 시):**
1. 수동 블랙리스트(ExcludedProduct) → `is_relevant=False`, reason=`manual_blacklist`
2. 내 상품(my_product_ids) → `is_relevant=False`, reason=`my_product`
3. 수동 포함 예외(IncludedOverride) → `is_relevant=True`, reason=`included_override`
4. 자동 필터(_check_relevance) → True/False, reason=`price_filter_min`|`price_filter_max`|`model_code`|`spec_keywords`|null

**스키마 변경:**
- `RankingItemResponse`에 `is_included_override: bool`, `relevance_reason: str | null` 필드 추가
- 상품 상세 API keywords[].rankings[]에 두 필드 포함

**즉시 반영 정책:**
- override 추가 시: 해당 naver_product_id의 기존 rankings → is_relevant=True 즉시 UPDATE
- override 삭제 시: 다음 크롤링에서 _check_relevance() 재판정 (즉시 반영 없음)

### 2026-02-26: 백엔드 아키텍처 개선 + 유지보수 인프라 구축

**Alembic 마이그레이션 도입:**
- `alembic init -t async migrations` → async 마이그레이션 프레임워크
- `migrations/env.py`: app의 config/models 동적 임포트
- baseline migration `fa420faac16c` 생성 + 기존 DB stamp
- main.py에서 수동 ALTER TABLE 130줄 제거 (31개 컬럼 + 3개 인덱스 + 1개 FK)

**매직넘버 → config.py 통합 (10개):**
- `CRAWL_SHIPPING_CONCURRENCY`, `CRAWL_SHIPPING_TIMEOUT`, `CRAWL_API_TIMEOUT`
- `SCHEDULER_CHECK_INTERVAL_MIN`, `DATA_RETENTION_DAYS`, `CLEANUP_BATCH_SIZE`
- `ALERT_DEDUP_HOURS`, `SPARKLINE_DAYS`, `MAX_KEYWORDS_PER_PRODUCT`

**Sentry 에러 추적:**
- `sentry-sdk[fastapi]` 추가, `SENTRY_DSN` 설정 시 자동 초기화
- `SENTRY_TRACES_SAMPLE_RATE` (기본 0.1) 환경변수 조절 가능

**구조화 JSON 로깅:**
- `python-json-logger` 추가, `app/core/logging.py` 모듈
- `LOG_FORMAT=json` (프로덕션) / `LOG_FORMAT=text` (로컬) 전환
- `LOG_LEVEL` 환경변수로 레벨 조절

**pytest 통합 테스트 (14개):**
- `tests/conftest.py`: SQLite in-memory + FastAPI TestClient 픽스처
- `tests/test_business_logic.py`: 가격 상태 판정 6개 + 마진 계산 3개
- `tests/test_users.py`: User CRUD API 4개
- `tests/test_health.py`: 헬스체크 1개
- `app/core/database.py`: SQLite 호환 엔진 설정 (pool_size 조건부 적용)

**크롤링 메트릭스 (/health 확장):**
- `crawl_metrics_24h`: 최근 24시간 크롤링 통계
  - `total`, `success`, `failed`, `success_rate` (%), `avg_duration_ms`

**서비스 레이어 분리 (thin controller 패턴):**
- `category_service.py`: 카테고리 트리 빌드 로직 (categories.py에서 추출)
- `cost_service.py`: 프리셋 적용 로직 (costs.py에서 추출)
- `price_service.py`: 가격 히스토리/스냅샷 로직 (prices.py에서 추출)

**기타 품질 개선:**
- alert_service: 무한정 쿼리 → `_fetch_latest_rankings()` 재사용 (bounded query)
- push_service: `webpush()` 동기 호출 → `asyncio.to_thread()` 비동기 래핑
- 복합 인덱스 추가: `(keyword_id, is_relevant, crawled_at)`
- 사용하지 않는 compat 라우트 4개 제거, dead code 삭제
- 모든 엔드포인트에 `response_model` 명시 (OpenAPI spec 완전성)
