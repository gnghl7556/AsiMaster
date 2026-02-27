# Plan: PWA Mobile (pwa-mobile)

## 1. 개요

### 1.1 기능 설명
Asimaster 웹앱을 PWA(Progressive Web App)로 전환하여, 모바일 기기에서 네이티브 앱처럼 사용할 수 있게 한다.
홈 화면 설치, 전체화면 실행, 오프라인 기본 지원, 웹 푸시 알림 연동을 포함한다.

### 1.2 배경 및 필요성
- 현재 모바일 브라우저에서 URL 직접 접속해야 함 → 접근성 떨어짐
- 토스처럼 홈 화면 아이콘으로 즉시 접근하는 UX 필요
- 웹 푸시 백엔드(VAPID)는 이미 구현 완료 → 프론트엔드 연결만 필요
- 앱스토어 심사 불필요, 배포 즉시 반영

### 1.3 목표
- 모바일 홈 화면 설치 → 전체화면(standalone) 실행
- 오프라인 시 마지막 조회 데이터 표시 (캐시 기반)
- 웹 푸시 알림 프론트엔드 연동 완성
- Lighthouse PWA 점수 90+ 달성

## 2. 요구사항

### 2.1 필수 요구사항 (Must Have)

| ID | 요구사항 | 설명 |
|----|---------|------|
| R1 | Web App Manifest | `manifest.json` 생성 (앱 이름, 아이콘, 테마색, standalone 모드) |
| R2 | 앱 아이콘 | 192x192, 512x512 PNG + maskable 아이콘 + apple-touch-icon + favicon |
| R3 | Service Worker 기본 | 정적 자산 캐싱 + 오프라인 폴백 페이지 |
| R4 | 메타데이터 확장 | layout.tsx에 manifest 링크, theme-color, apple 메타태그 추가 |
| R5 | SW 등록 | 클라이언트에서 Service Worker 자동 등록 |
| R6 | next-pwa 설정 | Next.js PWA 플러그인 연동 (SW 자동 생성) |

### 2.2 권장 요구사항 (Should Have)

| ID | 요구사항 | 설명 |
|----|---------|------|
| R7 | 설치 프롬프트 | `beforeinstallprompt` 이벤트 캡처 → "앱 설치" 배너/버튼 표시 |
| R8 | 웹 푸시 구독 UI | 설정 페이지에서 알림 구독 ON/OFF 토글 |
| R9 | 오프라인 상태 배너 | 네트워크 끊김 시 상단 경고 배너 표시 |

### 2.3 선택 요구사항 (Nice to Have)

| ID | 요구사항 | 설명 |
|----|---------|------|
| R10 | 스플래시 스크린 | iOS/Android 설치 시 앱 시작 화면 |
| R11 | PWA Shortcuts | 홈 화면 아이콘 롱프레스 → 바로가기 (대시보드, 상품목록) |
| R12 | 업데이트 알림 | 새 버전 배포 시 "업데이트 가능" 토스트 표시 |

## 3. 현재 상태 분석

### 3.1 이미 갖춰진 것 (✅)
- **반응형 UI**: Desktop(Sidebar) / Mobile(BottomNav) 이미 구현
- **다크모드**: CSS 변수 기반 완전 지원
- **웹 푸시 백엔드**: VAPID 키 + 구독 API 완성
- **상태 유지**: Zustand persist (localStorage)
- **React Query 캐싱**: staleTime 기반 데이터 캐시
- **HTTPS**: Vercel 자동 적용
- **Pretendard 폰트**: 한글 최적화 완료

### 3.2 필요한 것 (❌)
- `public/manifest.json` — 없음
- `public/sw.js` (Service Worker) — 없음
- `public/` 아이콘 자산 — 폴더 비어있음
- `layout.tsx` PWA 메타태그 — 없음
- `next.config.ts` PWA 플러그인 — 없음
- 웹 푸시 프론트엔드 구독 로직 — 없음

## 4. 기술 스택

| 구분 | 기술 | 이유 |
|------|------|------|
| PWA 프레임워크 | `@ducanh2912/next-pwa` | Next.js 15 App Router 호환, Workbox 기반, 활발한 유지보수 |
| Service Worker | Workbox (자동 생성) | 캐시 전략 설정 용이, next-pwa가 자동 관리 |
| 아이콘 생성 | `sharp` 또는 온라인 도구 | SVG/PNG → 다양한 사이즈 자동 생성 |
| 오프라인 감지 | `navigator.onLine` + 이벤트 | 별도 라이브러리 불필요 |

## 5. 구현 범위

### 5.1 변경 파일 (기존)
```
frontend/
├── next.config.ts              → withPWA() 래핑
├── src/app/layout.tsx          → 메타데이터 확장 (manifest, theme-color, apple 태그)
├── package.json                → @ducanh2912/next-pwa 의존성 추가
```

### 5.2 신규 파일
```
frontend/
├── public/
│   ├── manifest.json           → Web App Manifest
│   ├── favicon.ico             → 파비콘
│   ├── icon-192.png            → 앱 아이콘 (192×192)
│   ├── icon-512.png            → 앱 아이콘 (512×512)
│   ├── icon-maskable-192.png   → 마스크 가능 아이콘 (Android)
│   ├── icon-maskable-512.png   → 마스크 가능 아이콘 (Android)
│   └── apple-touch-icon.png    → iOS 아이콘 (180×180)
├── src/
│   ├── components/pwa/
│   │   ├── InstallPrompt.tsx   → "앱 설치" 배너 컴포넌트
│   │   ├── OfflineBanner.tsx   → 오프라인 상태 배너
│   │   └── PushSubscribe.tsx   → 웹 푸시 구독 토글
│   └── hooks/
│       ├── usePWAInstall.ts    → beforeinstallprompt 훅
│       └── useOnlineStatus.ts  → 온/오프라인 감지 훅
```

### 5.3 백엔드 변경
- **없음**: 웹 푸시 API 이미 완성, 백엔드 수정 불필요

## 6. 구현 순서

### Phase 1: 설치 가능한 PWA (R1~R6) — 핵심
1. `@ducanh2912/next-pwa` 설치
2. `next.config.ts`에 `withPWA()` 설정
3. `public/manifest.json` 생성
4. 앱 아이콘 생성 및 배치
5. `layout.tsx` 메타데이터 확장
6. 빌드 후 Lighthouse PWA 검증

### Phase 2: 사용자 경험 강화 (R7~R9)
7. `usePWAInstall` 훅 + `InstallPrompt` 컴포넌트
8. `useOnlineStatus` 훅 + `OfflineBanner` 컴포넌트
9. `PushSubscribe` 컴포넌트 (설정 페이지 연동)

### Phase 3: 선택 개선 (R10~R12)
10. 스플래시 스크린 설정 (manifest icons로 자동)
11. PWA Shortcuts 추가
12. SW 업데이트 감지 + 토스트 알림

## 7. 위험 요소 및 대응

| 위험 | 영향 | 대응 |
|------|------|------|
| iOS Safari PWA 제한 | 푸시 알림 미지원 (iOS 16.4 이전) | iOS 16.4+ 타겟, 폴백 안내 문구 |
| Service Worker 캐시 오염 | 오래된 화면 표시 | Workbox stale-while-revalidate + SW 버전 관리 |
| 아이콘 디자인 필요 | 앱 아이콘이 없으면 설치 불가 | 간단한 로고 생성 (텍스트 기반) |
| next-pwa 빌드 호환성 | Next.js 15와 충돌 가능 | `@ducanh2912/next-pwa` v5+ 사용 (검증됨) |

## 8. 성공 기준

- [ ] 모바일 크롬에서 "홈 화면에 추가" 가능
- [ ] 설치 후 standalone 모드 (URL바 없음) 실행
- [ ] 오프라인 시 폴백 페이지 표시
- [ ] Lighthouse PWA 점수 90+
- [ ] 웹 푸시 구독/해제 UI 동작
