---
scope: "backend/**"
---

# Backend 개발 규칙

## 코드 스타일
- 모든 함수에 type hint 사용
- 모든 I/O 작업은 async/await
- 의존성 주입 패턴 (get_db, get_settings)
- thin controller 패턴: API 라우터는 얇게, 비즈니스 로직은 services/에

## 테스트
- 새 API 엔드포인트 추가 시 반드시 pytest 테스트 작성
- 실행: `cd backend && python -m pytest tests/ -v`
- SQLite in-memory 사용 (외부 DB 불필요)
- `tests/conftest.py`의 fixture 활용

## 데이터베이스
- 스키마 변경은 반드시 Alembic 마이그레이션으로 관리
- 생성: `alembic revision --autogenerate -m "description"`
- 적용: `alembic upgrade head`
- main.py에 수동 ALTER TABLE 금지

## API 문서
- API 변경 후 CLAUDE.md의 API 변경 이력 섹션 업데이트
- OpenAPI 내보내기: `cd backend && python -m scripts.export_openapi`
- openapi.json을 API 변경과 함께 커밋

## 환경변수
- .env는 gitignore됨 — 커밋 금지
- 필수: DATABASE_URL, NAVER_CLIENT_ID, NAVER_CLIENT_SECRET
- 새 설정 추가 시 config.py의 Settings 클래스에 등록 + CLAUDE.md 문서화

## 파일 소유권
- `backend/` 폴더만 수정
- `frontend/` 폴더 절대 수정 금지
- `openapi.json`, `CLAUDE.md`는 공유 파일 — 수정 가능
