---
scope: "frontend/**"
---

# Frontend 개발 규칙

## 코드 스타일
- TypeScript strict mode
- React 19 hooks 패턴
- TailwindCSS 4 유틸리티 클래스 사용
- Glassmorphism 디자인 시스템 (glass-card 클래스)
- lucide-react 아이콘

## 타입 안전성
- API 타입은 `src/types/api.generated.ts`에서 import (수동 타입 정의 금지)
- 타입 생성: `npm run generate-types`
- `src/types/index.ts`의 re-export 레이어로 안정 타입명 유지

## API 연동
- Tanstack Query 사용 (useQuery, useMutation)
- API 클라이언트: `src/lib/` 내 함수 사용
- CLAUDE.md의 최신 API 명세 참조

## 빌드 검증
- 타입 체크: `npm run typecheck`
- 린트: `npm run lint`
- 빌드: `npm run build` (prebuild에서 자동 타입 생성)

## 파일 소유권
- `frontend/` 폴더만 수정
- `backend/` 폴더 절대 수정 금지
- `CLAUDE.md`는 공유 파일 — API 연동 관련 내용 참조

## 반응형 디자인
- 모바일 (375px), 태블릿 (768px), 데스크탑 (1920px) 확인
- 다크모드 CSS 변수 기반 대응
- Pretendard 폰트 사용
