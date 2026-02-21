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
- `PUT /api/v1/users/{id}` - 사업체 수정 (naver_store_name 설정)
- `POST /api/v1/users/{user_id}/products` - 상품 등록 (자동 키워드 등록)
- `GET /api/v1/users/{user_id}/products/{id}` - 상품 상세 (키워드별 순위 포함)
- `DELETE /api/v1/users/{user_id}/products/{id}` - 상품 삭제
- `POST /api/v1/crawl/product/{id}` - 상품 크롤링 실행
- `POST /api/v1/keywords/{product_id}` - 키워드 추가
- `GET /api/v1/dashboard/{user_id}` - 대시보드 요약

## 핵심 모델 관계
User → Products → SearchKeywords → KeywordRankings
                                  → CrawlLogs
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
- **Claude Code**: `backend/` 폴더 전담. FastAPI, DB 모델링, 비즈니스 로직, 크롤링 엔진 구축을 담당한다. (`frontend/` 폴더는 절대 건드리지 않는다)
- **Antigravity**: `frontend/` 폴더 전담. Next.js 화면 구현, 컴포넌트 개발 및 브라우저를 통한 QA 테스트를 담당한다.

### 작업 동기화 규칙
- 두 AI는 같은 로컬 폴더(같은 Git 브랜치)를 바라보고 작업한다.
- **API 명세 기록**: Claude가 백엔드 API를 신규 작성하거나 수정하면, 반드시 `docs/api-specs/` 폴더 등에 명세(Endpoint, Request/Response JSON)를 기록하거나 CLAUDE.md에 요약해야 한다. Antigravity는 이 문서를 보고 프론트엔드를 연동한다.
