# AsiMaster 코드 개선안 (단계별)

## 작업 분담
- **Claude Code**: `backend/` 전담 (FastAPI, DB, 크롤링, 키워드 엔진)
- **Codex**: `frontend/` 전담 (Next.js, UI, API 연동)

---

# Phase 1: 보안 기반 구축

> 목표: 외부 접근 차단, 데이터 보호

## [Backend] 1-1. 인증/인가 시스템 도입

- **현재**: 모든 API에 인증 없음. URL만 알면 누구나 데이터 조회/수정/삭제 가능
- **위치**: `app/api/` 전체 라우터
- **문제 예시**:
  - `GET /users` → 전체 사업체 목록 노출
  - `DELETE /users/{id}` → 아무 사업체 삭제 가능
  - `POST /crawl/user/{id}` → 외부에서 대량 크롤링 유발 가능
- **작업**:
  - JWT 기반 인증 미들웨어 구현 (`app/core/auth.py` 신규)
  - 로그인/토큰 발급 API (`POST /auth/login`, `POST /auth/refresh`)
  - 모든 라우터에 `Depends(get_current_user)` 적용

## [Backend] 1-2. 리소스 소유권 검증

- **현재**: `product_id`만 알면 타인 상품 접근 가능
- **위치**: `app/api/products.py` (GET/PUT/DELETE/PATCH 단일 상품 API)
- **작업**:
  - 모든 단일 상품 API에서 `product.user_id == current_user.id` 검증
  - 공통 의존성 함수 `get_own_product(product_id, current_user)` 구현

## [Backend] 1-3. SSRF 방어

- **현재**: 사용자 입력 URL로 서버가 직접 HTTP 요청
- **위치**: `app/crawlers/store_scraper.py:143`
- **작업**: 허용 도메인 화이트리스트 적용 (`smartstore.naver.com`, `m.smartstore.naver.com`)

## [Backend] 1-4. CORS 설정 강화

- **현재**: `allow_methods=["*"]`, `allow_headers=["*"]`
- **위치**: `app/main.py:175-181`
- **작업**: 필요한 메서드(GET/POST/PUT/DELETE/PATCH)와 헤더만 명시적 허용

## [Backend] 1-5. 필수 환경변수 검증

- **현재**: `NAVER_CLIENT_ID/SECRET` 빈 문자열이어도 에러 없이 시작
- **위치**: `app/core/config.py:13-14`
- **작업**: 앱 시작 시 필수 환경변수 존재 여부 검증, 미설정 시 시작 차단

## [Frontend] 1-6. 인증 UI 연동

- **작업**:
  - 로그인/로그아웃 페이지 구현
  - API 클라이언트(`lib/api/client.ts`)에 Authorization 헤더 추가
  - 토큰 저장 (httpOnly cookie 또는 메모리)
  - 토큰 만료 시 리프레시 또는 재로그인 처리
  - 미인증 상태에서 보호 라우트 접근 시 로그인 페이지 리다이렉트

---

# Phase 2: 크롤링 안정성 개선

> 목표: 크롤링 시스템의 충돌 방지, 데이터 정합성 보장

## [Backend] 2-1. 크롤링 Lock 메커니즘

- **현재**: 크롤링 동시 실행 방지 없음
- **위치**: `app/crawlers/manager.py`, `app/scheduler/jobs.py`, `app/api/crawl.py`
- **문제**:
  - 수동 크롤링 + 스케줄러 크롤링 동시 실행 → 중복 데이터
  - 크롤링 버튼 연타 → 네이버 API 할당량 낭비
  - 유저 전체 크롤링 중 개별 상품 크롤링 → 데이터 정합성 깨짐
  - 스케줄러 작업 겹침 (이전 작업 미완료 상태에서 다음 주기 시작)
- **작업**:
  - `CrawlManager`에 유저별/상품별 `asyncio.Lock` 도입
  - 이미 크롤링 중이면 `409 Conflict` 반환
  - APScheduler `max_instances=1` 설정
  - 크롤링 상태 조회 API 추가 (`GET /crawl/running/{user_id}`)

## [Backend] 2-2. Rate Limiting

- **현재**: 크롤링 API 호출 제한 없음
- **위치**: `app/api/crawl.py`
- **작업**: `slowapi` 등으로 엔드포인트별 Rate Limit 적용 (예: 크롤링 1분 1회)

## [Backend] 2-3. 크롤링 에러 격리

- **현재**: 한 유저 크롤링 실패 시 같은 세션 계속 사용
- **위치**: `app/scheduler/jobs.py:35-59`
- **작업**: 유저별 별도 DB 세션 사용, 실패한 유저가 다른 유저에 영향 안 미치도록 격리

## [Backend] 2-4. 크롤링 결과 저장 에러 처리

- **현재**: `_save_keyword_result`에 try-except 없음 → 한 키워드 실패 시 전체 중단
- **위치**: `app/crawlers/manager.py:62-130`
- **작업**: 키워드별 저장을 try-except로 감싸고, 실패한 키워드만 로깅 후 다음 진행

## [Frontend] 2-5. 크롤링 상태 UI 반영

- **작업**:
  - 크롤링 진행 중 버튼 비활성화 + 로딩 스피너
  - `409 Conflict` 응답 시 "이미 크롤링 진행 중입니다" 토스트 메시지
  - 크롤링 완료 시 자동 데이터 갱신 (react-query invalidation)

---

# Phase 3: 성능 최적화

> 목표: 메모리 사용량 절감, DB 쿼리 효율화

## [Backend] 3-1. Ranking 데이터 메모리 로딩 최적화

- **현재**: 모든 상품의 전체 ranking 히스토리를 한 번에 메모리 로드
- **위치**: `app/services/product_service.py:108` (`get_product_list_items`)
- **문제**: 상품 100개 x 키워드 5개 x 순위 1000건 = 50만 건 매번 로드
- **작업**:
  - 상품 목록 API: 최신 크롤링 1회분만 로드 (최근 24시간 or 최신 crawled_at 기준)
  - 상품 상세 API: sparkline용 데이터만 최근 30일 집계 쿼리
  - 대시보드: 별도 경량 SQL 집계 쿼리 사용 (현재 `get_product_list_items` 재사용하고 있음)

## [Backend] 3-2. DB 레벨 페이지네이션

- **현재**: 전체 데이터를 메모리에 올린 후 Python에서 슬라이싱
- **위치**: `app/services/product_service.py:246-247`
- **작업**: SQL `OFFSET/LIMIT` + `COUNT(*)` 로 DB 레벨 페이지네이션 구현

## [Backend] 3-3. N+1 쿼리 해소

- **위치 1**: `app/crawlers/manager.py:228-241`
  - 상품마다 개별 블랙리스트 조회 → `WHERE product_id IN (...)` 단일 쿼리
  - 상품마다 개별 `db.get(Product, pid)` → 단일 `IN` 쿼리로 일괄 조회
- **위치 2**: `app/services/alert_service.py:49-121`
  - 키워드마다 3번씩 DB 쿼리 (10키워드 = 30쿼리)
  - → 전체 키워드의 ranking을 한 번에 조회 후 메모리에서 분배

## [Backend] 3-4. DB 커넥션 풀 설정

- **현재**: `pool_size`, `max_overflow` 기본값(5, 10) 사용
- **위치**: `app/core/database.py:11`
- **작업**: 동시 크롤링 고려하여 풀 사이즈 명시적 설정 (예: `pool_size=10, max_overflow=20`)

## [Backend] 3-5. keyword_rankings 데이터 보존 정책

- **현재**: 데이터가 무한히 쌓임 (Railway 무료 500MB 제한)
- **위치**: `app/models/keyword_ranking.py`
- **작업**:
  - 30일 이상 된 ranking 데이터 자동 삭제 스케줄러 작업 추가
  - `naver_product_id` 컬럼에 인덱스 추가

## [Backend] 3-6. httpx 클라이언트 일관성

- **현재**: NaverCrawler는 클라이언트 재사용, store_scraper는 매번 새로 생성
- **위치**: `app/crawlers/store_scraper.py:144,231`
- **작업**: 공유 httpx 클라이언트 또는 일관된 패턴 적용

---

# Phase 4: 키워드 엔진 고도화 (SEO 기반)

> 목표: 네이버 쇼핑 SEO를 반영한 스마트 키워드 추천 시스템 구축

## 설계 원칙

네이버 쇼핑 검색 순위는 **적합도(상품명/카테고리/브랜드/속성)** + **인기도(클릭/판매/리뷰)** + **신뢰도(페널티)** 로 결정됨.
특히 **필드 연관도** 개념이 핵심 — 같은 키워드라도 올바른 필드(브랜드/카테고리/속성)에 기재된 상품이 상위 노출됨.

참고: [네이버 쇼핑 SEO - 적합도](https://school.itemscout.io/article/seo-strategy-1), [상품명 최적화](https://www.plto.com/content/Blog/1308/)

## [Backend] 4-1. 토큰 분류기 (TokenClassifier) 구현

**신규 파일**: `app/services/keyword_engine/classifier.py`

상품명을 단어 단위로 분리 후, 각 토큰에 카테고리 태그를 부여하는 전처리 엔진.

### 분류 카테고리

| 카테고리 | 설명 | 예시 | 분류 방법 |
|---------|------|------|----------|
| `BRAND` | 브랜드/제조사 | 삼성전자, LG, 쿠쿠, 다이슨 | 사전 + 네이버 API `brand/maker` 필드 |
| `SERIES` | 제품 라인/시리즈 | 비스포크, 갤럭시, 오브제 | 브랜드별 시리즈 사전, 위치 휴리스틱 |
| `TYPE` | 제품 종류 | 냉장고, 세탁기, 물티슈, 마스크 | 카테고리 사전 (네이버 `category1~4` 축적) |
| `MODEL` | 모델 코드 | RF85B9121AP, SHE-100 | 정규식 `[A-Z]*\d{3,}[A-Z0-9\-]*` |
| `QUANTITY` | 수량/개수 | 200개입, 30매, 2박스 | 정규식 (현재 패턴 확장) |
| `CAPACITY` | 용량/무게 | 875L, 500ml, 1kg | 단위 기반 정규식 |
| `SIZE` | 크기/규격 | 소형, 대형, 110cm, XL | 크기 사전 + 단위 정규식 |
| `COLOR` | 색상 | 화이트, 블랙, 코타화이트 | 색상 사전 (한글/영문) |
| `MATERIAL` | 재질/소재 | 스테인리스, 실리콘, 면 | 소재 사전 |
| `FEATURE` | 기능/특성 | 무선, 방수, 에너지1등급 | 기능 키워드 사전 |
| `MODIFIER` | 수식어 (검색에 불필요) | 최신형, 인기, 정품, 무료배송 | 불용어 사전 |

### 분류 방법 (3가지 전략 조합)

**A. 정규식 기반 (Pattern)** — 즉시 적용 가능
```
MODEL:    [A-Z]{0,5}\d{3,}[A-Z0-9\-]*     → RF85B9121AP, SHE-100
CAPACITY: \d+(?:\.\d+)?(?:L|ml|g|kg|cc)     → 875L, 500ml
SIZE:     \d+(?:cm|mm|인치)|(?:XS|S|M|L|XL) → 110cm, XL
QUANTITY: \d+(?:개입|개|매|장|팩|박스|...)    → 200개입, 30매
```

**B. 사전 기반 (Dictionary)** — 기본 사전 + 점진적 확장
```
BRAND:    {삼성전자, LG전자, 쿠쿠, 다이슨, 필립스, ...}
COLOR:    {화이트, 블랙, 그레이, 실버, 베이지, 네이비, 레드, 블루, ...}
MATERIAL: {스테인리스, 실리콘, 면, 폴리에스터, 가죽, 우드, ...}
MODIFIER: {최신형, 인기, 정품, 무료배송, 당일발송, 특가, 할인, ...}
```

**C. 크롤링 데이터 자동 학습** — DB 축적 후 자동 확장
```
keyword_rankings 테이블 활용:
  - brand 필드 → BRAND 사전 자동 구축
  - maker 필드 → BRAND 사전 보강
  - category1~4 → TYPE 사전 자동 구축
```

### 분류 예시

```
입력: "삼성전자 비스포크 냉장고 RF85B9121AP 프리스탠딩 875L 코타화이트"

분류 결과:
  BRAND:    [삼성전자]     ← 사전 매칭
  SERIES:   [비스포크]     ← 위치 휴리스틱 (브랜드 다음)
  TYPE:     [냉장고]       ← 카테고리 사전
  MODEL:    [RF85B9121AP]  ← 정규식 매칭
  FEATURE:  [프리스탠딩]    ← 기능 사전
  CAPACITY: [875L]         ← 정규식 매칭
  COLOR:    [코타화이트]    ← 색상 사전
```

## [Backend] 4-2. SEO 가중치 엔진 구현

**신규 파일**: `app/services/keyword_engine/weights.py`

네이버 쇼핑 SEO의 필드 연관도 + 표준상품명 구성 순서를 반영한 가중치 체계.

### 기본 가중치 (네이버 SEO 반영)

| 카테고리 | 가중치 | 네이버 SEO 근거 |
|---------|--------|----------------|
| `MODEL` | **10** | 가장 정확한 식별자, 세부 키워드 |
| `BRAND` | **9** | 네이버가 브랜드 필드에 별도 높은 가중치 부여 |
| `TYPE` | **9** | 네이버 카테고리 필드에 높은 가중치, 카테고리 선호도 반영 |
| `SERIES` | **7** | 표준상품명 2번째 순서, 검색 범위 축소에 효과적 |
| `CAPACITY` | **5** | 상품 구분 핵심 요소 (용량/무게) |
| `QUANTITY` | **4** | 가격 비교 시 중요 (개수/수량) |
| `SIZE` | **4** | 상품 구분 요소 (의류/생활용품에서 중요도 상승) |
| `COLOR` | **3** | 표준상품명 포함, 검색 구분 보조 요소 |
| `MATERIAL` | **3** | 표준상품명 6번째, 소재 기반 검색 존재 |
| `FEATURE` | **3** | 기능/특성은 보조 검색어 |
| `MODIFIER` | **-2** | 수식어 포함 시 어뷰징 판단 → 반드시 제외 |

### 카테고리별 가중치 조정 (선택적 확장)

업종별로 중요한 속성이 다르므로, 카테고리에 따라 가중치 미세 조정 가능:
- 가전/전자: MODEL 가중치 최상위
- 생활용품/소모품: QUANTITY 가중치 상향
- 의류/패션: COLOR, SIZE 가중치 상향
- 식품: CAPACITY(용량), QUANTITY(수량) 가중치 상향

## [Backend] 4-3. 키워드 생성기 (KeywordGenerator) 구현

**신규 파일**: `app/services/keyword_engine/generator.py`

분류된 토큰 + 가중치를 기반으로 최적의 키워드 5개를 조합하는 엔진.

### 조합 규칙

**규칙 1: 경쟁도 밸런스 (5개 중)**
```
- 세부 키워드 2개: 모델명 포함, 정확한 타겟 (경쟁 낮음)
- 중간 키워드 2개: 브랜드+타입, 시리즈+타입 (경쟁 중간)
- 넓은 키워드 1개: 카테고리 노출용 (경쟁 높음, 인기도 기여)
```

**규칙 2: 네이버 표준상품명 순서 준수**
```
브랜드 → 시리즈 → 모델명 → 타입 → 색상 → 소재 → 수량 → 사이즈
```

**규칙 3: 길이 최적화**
```
- 각 키워드 50자 이내 (네이버 권장)
- 단어 수 2~5개가 최적 (너무 길면 검색 정확도 하락)
```

**규칙 4: 중복/불용어 제거**
```
- MODIFIER 카테고리 토큰 완전 제외
- 스토어명 제거
- 중복 단어 제거
- 조사(은/는/이/가) 제거
```

**규칙 5: 띄어쓰기 변형 고려**
```
"생삼겹살" vs "생 삼겹살"은 다른 검색 결과
→ 주요 합성어는 붙여쓰기 버전도 후보에 포함
```

### 조합 예시

```
입력: "삼성전자 비스포크 냉장고 RF85B9121AP 프리스탠딩 875L 코타화이트"

분류:
  BRAND(9): 삼성전자
  SERIES(7): 비스포크
  TYPE(9): 냉장고
  MODEL(10): RF85B9121AP
  FEATURE(3): 프리스탠딩
  CAPACITY(5): 875L
  COLOR(3): 코타화이트

생성된 키워드 (점수 내림차순):
  1. "비스포크 냉장고 RF85B9121AP"  → TYPE+MODEL+SERIES = 세부 (점수 26)
  2. "삼성 냉장고 RF85B9121AP"      → BRAND+TYPE+MODEL = 세부 (점수 28)
  3. "삼성 비스포크 냉장고"          → BRAND+SERIES+TYPE = 중간 (점수 25)
  4. "비스포크 냉장고 875L"          → SERIES+TYPE+CAPACITY = 중간 (점수 21)
  5. "냉장고 RF85B9121AP"           → TYPE+MODEL = 넓은 (점수 19)

+ 필드 배치 가이드:
  - 브랜드 필드: "삼성전자"
  - 카테고리: "주방가전 > 냉장고"
```

## [Backend] 4-4. 사전 데이터 자동 구축 API

**신규 파일**: `app/services/keyword_engine/dictionary.py`

크롤링 데이터(keyword_rankings)에서 브랜드/카테고리 사전을 자동 구축.

- `keyword_rankings.brand` → BRAND 사전 자동 확장
- `keyword_rankings.maker` → BRAND 사전 보강
- `keyword_rankings.category1~4` → TYPE 사전 자동 확장
- 주기적 갱신 (일 1회 스케줄러 또는 수동 트리거)

## [Backend] 4-5. 기존 suggest_keywords 교체

- **현재**: `app/crawlers/store_scraper.py:31-138` (단순 정규식 + 위치 휴리스틱)
- **작업**:
  - 기존 `suggest_keywords` 함수를 새 키워드 엔진으로 교체
  - `store_scraper.py`에서는 엔진 호출만 수행
  - 스토어 불러오기, 상품 등록 시 모두 새 엔진 사용

## [Backend] 4-6. 키워드 추천 API

**신규 엔드포인트**: `POST /api/v1/keywords/suggest`

```
Request:
{
  "product_name": "삼성전자 비스포크 냉장고 RF85B9121AP 프리스탠딩 875L 코타화이트",
  "store_name": "삼성전자직영",  // optional
  "category_hint": "주방가전"    // optional
}

Response:
{
  "tokens": [
    {"text": "삼성전자", "category": "BRAND", "weight": 9},
    {"text": "비스포크", "category": "SERIES", "weight": 7},
    {"text": "냉장고", "category": "TYPE", "weight": 9},
    {"text": "RF85B9121AP", "category": "MODEL", "weight": 10},
    {"text": "프리스탠딩", "category": "FEATURE", "weight": 3},
    {"text": "875L", "category": "CAPACITY", "weight": 5},
    {"text": "코타화이트", "category": "COLOR", "weight": 3}
  ],
  "keywords": [
    {"keyword": "비스포크 냉장고 RF85B9121AP", "score": 26, "level": "specific"},
    {"keyword": "삼성 냉장고 RF85B9121AP", "score": 28, "level": "specific"},
    {"keyword": "삼성 비스포크 냉장고", "score": 25, "level": "medium"},
    {"keyword": "비스포크 냉장고 875L", "score": 21, "level": "medium"},
    {"keyword": "냉장고 RF85B9121AP", "score": 19, "level": "broad"}
  ],
  "field_guide": {
    "brand": "삼성전자",
    "category": "주방가전 > 냉장고"
  }
}
```

## [Frontend] 4-7. 키워드 추천 UI 개선

- **작업**:
  - 상품 등록/스토어 불러오기 시 토큰 분류 결과 시각화
    - 각 토큰을 카테고리별 색상 태그로 표시 (BRAND=파랑, MODEL=보라, TYPE=초록 등)
  - 추천 키워드에 경쟁도 레벨 표시 (`specific` / `medium` / `broad`)
  - 추천 키워드 점수 표시 (선택 참고용)
  - 필드 배치 가이드 표시 ("브랜드 필드에 '삼성전자' 입력 권장")
  - 사용자가 토큰 카테고리를 수동 변경할 수 있는 드롭다운 (오분류 시 교정)

---

# Phase 5: 인프라 안정화

> 목표: 스키마 관리 체계화, 운영 모니터링

## [Backend] 5-1. Alembic 마이그레이션 도입

- **현재**: `main.py`에 `ALTER TABLE`을 하드코딩 리스트로 관리
- **위치**: `app/main.py:20-64`
- **문제**: 이력 추적 불가, 롤백 불가, SQL Injection 잠재 위험
- **작업**:
  - Alembic 초기화 (`alembic init`)
  - 현재 스키마를 기준으로 initial migration 생성
  - 기존 `apply_schema_changes` 함수 및 `cleanup_old_tables` 함수 제거
  - 배포 시 `alembic upgrade head` 자동 실행 (Dockerfile에 추가)

## [Backend] 5-2. 헬스체크 개선

- **현재**: 항상 `{"status":"ok"}` 반환 (실제 상태 미확인)
- **위치**: `app/main.py:186-188`
- **작업**:
  - DB 연결 ping
  - 스케줄러 동작 여부 확인
  - 마지막 크롤링 시각 확인
  - 종합 상태 반환 (`healthy` / `degraded` / `unhealthy`)

## [Backend] 5-3. 구조화된 로깅

- **현재**: `logger.info(f"...{variable}...")` 형태
- **작업**: JSON 구조화 로깅으로 전환 (운영 모니터링/파싱 용이)

---

# Phase 6: 코드 품질 개선

> 목표: 유지보수성 향상, 기술 부채 정리

## [Backend] 6-1. `datetime.utcnow()` 교체

- Python 3.12부터 deprecated, 프로젝트 전체에서 사용 중
- **위치**: `manager.py:125`, `product_service.py:138,318`, `jobs.py:33`, `crawl.py:60`
- **작업**: `datetime.now(datetime.UTC)`로 전환

## [Backend] 6-2. 코드 중복 제거

- **현재**: `product_service.py`에서 상품 목록/상세에 블랙리스트 필터링, 최저가 계산, sparkline 로직 중복
- **작업**: 공통 유틸리티 함수 추출 (`_calculate_lowest_price`, `_build_sparkline`, `_filter_excluded` 등)

## [Backend] 6-3. 비즈니스 로직 서비스 계층 분리

- **현재**: 블랙리스트 추가/중복체크/Ranking 업데이트가 라우터에 직접 구현
- **위치**: `app/api/products.py:142-192`
- **작업**: 서비스 계층으로 분리 (`app/services/excluded_service.py` 등)

## [Backend] 6-4. ZeroDivisionError 방어

- **위치**: `app/services/product_service.py:19` (`lowest_price`가 0인 경우)
- **작업**: 가격 계산 함수에 0 체크 추가

## [Backend] 6-5. LIKE 검색 이스케이핑

- **위치**: `app/services/product_service.py:119`
- **현재**: 사용자 입력의 `%`, `_` 와일드카드가 이스케이프되지 않음
- **작업**: 검색어에서 SQL LIKE 특수문자 이스케이프 처리

---

# 단계별 요약

| Phase | 목표 | Backend | Frontend | 예상 의존성 |
|-------|------|---------|----------|------------|
| **1** | 보안 기반 | 인증/인가, 소유권 검증, SSRF, CORS | 로그인 UI, 토큰 관리 | 없음 (즉시 착수 가능) |
| **2** | 크롤링 안정성 | Lock, Rate Limit, 에러 격리 | 크롤링 상태 UI | Phase 1 완료 후 |
| **3** | 성능 최적화 | 메모리 최적화, 페이지네이션, N+1 해소, 데이터 정리 | - | Phase 2 완료 후 |
| **4** | 키워드 엔진 | 토큰 분류기, 가중치 엔진, 키워드 생성기, 사전 자동 구축 | 토큰 시각화, 추천 UI | Phase 3 완료 후 (DB 데이터 축적 필요) |
| **5** | 인프라 안정화 | Alembic, 헬스체크, 로깅 | - | Phase 1 이후 언제든 |
| **6** | 코드 품질 | deprecated 교체, 중복 제거, 로직 분리 | - | 독립적 (언제든 가능) |

---

# 참고 자료

## 네이버 쇼핑 SEO
- [노출 순위 올리기 - 네이버 이해하기 (아이템스카우트)](https://school.itemscout.io/article/seo-strategy-1)
- [네이버 쇼핑 SEO 알고리즘 - 적합도 편 (아이보스)](https://www.i-boss.co.kr/ab-6141-63700)
- [네이버 쇼핑 상품명 최적화 가이드 (plto)](https://www.plto.com/content/Blog/1308/)
- [스마트스토어 상위노출 키워드 분석 (토스페이먼츠)](https://www.tosspayments.com/blog/articles/semo-85)
- [스마트스토어 상품명 - 네이버 키워드 검색 활용 (windly)](https://www.windly.cc/blog/naver-search-ad-keyword-tool-smartstore-seo)
- [네이버 쇼핑 노출 검색 알고리즘 (plto)](https://www.plto.com/content/Blog/1306/)

## 프로젝트 파일 구조

```
asimaster/
  backend/                          # Claude Code 담당
    app/
      api/                          # 라우터 (12개)
      core/                         # config, database, deps, auth(신규)
      crawlers/                     # naver, manager, store_scraper
      models/                       # SQLAlchemy 모델 (8개)
      schemas/                      # Pydantic 스키마
      services/                     # 비즈니스 로직
        keyword_engine/             # 신규: 키워드 엔진
          classifier.py             #   토큰 분류기
          weights.py                #   SEO 가중치
          generator.py              #   키워드 생성기
          dictionary.py             #   사전 데이터 관리
      scheduler/                    # APScheduler
  frontend/                         # Codex 담당
    src/
      app/                          # 페이지
      components/                   # UI 컴포넌트
      lib/                          # API 클라이언트, hooks, utils
      stores/                       # Zustand 스토어
      types/                        # TypeScript 타입
```
