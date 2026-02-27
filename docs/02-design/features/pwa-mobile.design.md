# Design: PWA Mobile (pwa-mobile)

> Plan 문서: `docs/01-plan/features/pwa-mobile.plan.md`

## 1. 아키텍처 개요

```
┌─────────────────────────────────────────────────────┐
│                    브라우저                           │
│                                                     │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │  Next.js App │  │ Service Worker│  │  manifest  │ │
│  │  (React 19)  │←→│  (Workbox)   │  │   .json    │ │
│  └──────┬───────┘  └──────┬───────┘  └────────────┘ │
│         │                  │                         │
│         │    ┌─────────────┴──────────────┐          │
│         │    │        Cache Storage       │          │
│         │    │  ┌───────┐  ┌───────────┐  │          │
│         │    │  │Assets │  │API Cache  │  │          │
│         │    │  │(pre)  │  │(runtime)  │  │          │
│         │    │  └───────┘  └───────────┘  │          │
│         │    └────────────────────────────┘          │
│         ▼                                            │
│  ┌─────────────────┐                                │
│  │  Push Manager    │  ← VAPID 공개키                │
│  │  (Web Push API)  │  → 구독 정보 → Backend         │
│  └─────────────────┘                                │
└─────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Backend (FastAPI)              │
│  ✅ 이미 구현됨                  │
│  - POST /push/subscribe        │
│  - DELETE /push/subscribe       │
│  - GET /push/vapid-public-key   │
└─────────────────────────────────┘
```

## 2. 파일 구조 및 변경 범위

### 2.1 신규 파일

```
frontend/
├── public/
│   ├── manifest.json               # [R1] Web App Manifest
│   ├── favicon.ico                 # [R2] 파비콘 (32×32)
│   ├── icon-192.png                # [R2] 앱 아이콘
│   ├── icon-512.png                # [R2] 앱 아이콘 (스플래시용)
│   ├── icon-maskable-192.png       # [R2] Android 적응형 아이콘
│   ├── icon-maskable-512.png       # [R2] Android 적응형 아이콘
│   └── apple-touch-icon.png        # [R2] iOS 아이콘 (180×180)
├── src/
│   ├── components/pwa/
│   │   ├── InstallPrompt.tsx       # [R7] 앱 설치 배너
│   │   ├── OfflineBanner.tsx       # [R9] 오프라인 상태 배너
│   │   ├── PushToggle.tsx          # [R8] 웹 푸시 구독 토글
│   │   └── ServiceWorkerUpdater.tsx # [R12] SW 업데이트 알림
│   └── hooks/
│       ├── usePWAInstall.ts        # [R7] beforeinstallprompt 훅
│       ├── useOnlineStatus.ts      # [R9] 온/오프라인 감지 훅
│       └── usePushSubscription.ts  # [R8] 웹 푸시 구독 관리 훅
```

### 2.2 변경 파일

| 파일 | 변경 내용 |
|------|----------|
| `next.config.ts` | `@ducanh2912/next-pwa` withPWA() 래핑 |
| `src/app/layout.tsx` | manifest 링크, theme-color, apple 메타태그, viewport |
| `src/app/providers.tsx` | `<InstallPrompt>`, `<OfflineBanner>`, `<ServiceWorkerUpdater>` 추가 |
| `src/app/settings/page.tsx` | "알림 설정" 메뉴 항목 추가 |
| `package.json` | `@ducanh2912/next-pwa` 의존성 추가 |
| `.gitignore` | SW 빌드 산출물 제외 패턴 추가 |

## 3. 상세 설계

### 3.1 Web App Manifest (R1)

**파일**: `public/manifest.json`

```json
{
  "name": "Asimaster - 가격 모니터링",
  "short_name": "Asimaster",
  "description": "경쟁사 가격 모니터링 솔루션",
  "start_url": "/dashboard",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait-primary",
  "theme_color": "#0f172a",
  "background_color": "#f8fafc",
  "lang": "ko",
  "categories": ["business", "productivity"],
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icon-maskable-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "maskable"
    },
    {
      "src": "/icon-maskable-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ],
  "shortcuts": [
    {
      "name": "대시보드",
      "short_name": "대시보드",
      "url": "/dashboard",
      "icons": [{ "src": "/icon-192.png", "sizes": "192x192" }]
    },
    {
      "name": "상품 목록",
      "short_name": "상품",
      "url": "/products",
      "icons": [{ "src": "/icon-192.png", "sizes": "192x192" }]
    }
  ]
}
```

**설계 결정:**
- `start_url: "/dashboard"` — 앱 실행 시 대시보드가 메인 화면
- `theme_color: "#0f172a"` — globals.css의 `--foreground` (다크 계열 상단 바)
- `background_color: "#f8fafc"` — globals.css의 `--background` (라이트 모드 스플래시)
- `orientation: "portrait-primary"` — 모바일 세로 모드 우선 (가격 테이블 가독성)

### 3.2 앱 아이콘 (R2)

**아이콘 디자인 스펙:**

| 파일명 | 사이즈 | 용도 | 설명 |
|--------|--------|------|------|
| `favicon.ico` | 32×32 | 브라우저 탭 | 간결한 "A" 로고 |
| `icon-192.png` | 192×192 | Android 홈 화면 | 둥근 모서리 자동 |
| `icon-512.png` | 512×512 | Android 스플래시 | 고해상도 |
| `icon-maskable-192.png` | 192×192 | Android 적응형 | safe zone(80%) 내 로고 |
| `icon-maskable-512.png` | 512×512 | Android 적응형 | safe zone(80%) 내 로고 |
| `apple-touch-icon.png` | 180×180 | iOS 홈 화면 | 여백 없이 꽉 채움 |

**디자인 가이드:**
- 배경색: `#0f172a` (슬레이트 900, 다크 계열)
- 로고: "A" 텍스트 또는 차트 아이콘 (흰색)
- maskable: 아이콘을 중앙 80% 영역에 배치 (테두리 잘림 방지)
- SVG 원본을 만들고 각 사이즈로 export

### 3.3 next-pwa 설정 (R6)

**파일**: `next.config.ts`

```typescript
import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    runtimeCaching: [
      {
        // API 요청: 네트워크 우선, 실패 시 캐시
        urlPattern: /^https?:\/\/.*\/api\/v1\/.*/i,
        handler: "NetworkFirst",
        options: {
          cacheName: "api-cache",
          expiration: {
            maxEntries: 64,
            maxAgeSeconds: 60 * 60, // 1시간
          },
          networkTimeoutSeconds: 5,
        },
      },
      {
        // 이미지: 캐시 우선
        urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
        handler: "CacheFirst",
        options: {
          cacheName: "image-cache",
          expiration: {
            maxEntries: 100,
            maxAgeSeconds: 60 * 60 * 24 * 30, // 30일
          },
        },
      },
      {
        // 폰트: 캐시 우선 (장기 보관)
        urlPattern: /\.(?:woff|woff2|ttf|otf)$/i,
        handler: "CacheFirst",
        options: {
          cacheName: "font-cache",
          expiration: {
            maxEntries: 10,
            maxAgeSeconds: 60 * 60 * 24 * 365, // 1년
          },
        },
      },
      {
        // 페이지 네비게이션: 네트워크 우선
        urlPattern: /^https?:\/\/.*\/?$/i,
        handler: "NetworkFirst",
        options: {
          cacheName: "page-cache",
          expiration: {
            maxEntries: 32,
            maxAgeSeconds: 60 * 60 * 24, // 24시간
          },
        },
      },
    ],
  },
});

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default withPWA(nextConfig);
```

**캐시 전략:**

| 리소스 | 전략 | TTL | 이유 |
|--------|------|-----|------|
| API (`/api/v1/*`) | NetworkFirst | 1시간 | 최신 가격 데이터 우선, 오프라인 시 캐시 |
| 이미지 | CacheFirst | 30일 | 상품 이미지는 자주 변경되지 않음 |
| 폰트 | CacheFirst | 1년 | Pretendard 폰트 고정 |
| 페이지 | NetworkFirst | 24시간 | 최신 HTML 우선 |

**개발 환경:**
- `disable: process.env.NODE_ENV === "development"` — 로컬 개발 시 SW 비활성화 (HMR 충돌 방지)

### 3.4 메타데이터 확장 (R4)

**파일**: `src/app/layout.tsx`

```typescript
import type { Metadata, Viewport } from "next";

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "Asimaster - 가격 모니터링",
  description: "경쟁사 가격 모니터링 솔루션",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Asimaster",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};
```

**설계 결정:**
- `viewport`를 별도 export — Next.js 15 권장 패턴 (`metadata`에서 분리)
- `userScalable: false` — 앱 같은 느낌 (더블탭 줌 방지)
- `statusBarStyle: "black-translucent"` — iOS에서 상태바 투명 처리
- `themeColor` 라이트/다크 분기 — 시스템 테마에 따른 상태바 색상 자동 전환

### 3.5 설치 프롬프트 (R7)

**훅**: `src/hooks/usePWAInstall.ts`

```typescript
"use client";
import { useState, useEffect } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // 이미 설치된 경우 감지
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const installedHandler = () => setIsInstalled(true);

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    return outcome === "accepted";
  };

  return {
    canInstall: !!deferredPrompt && !isInstalled,
    isInstalled,
    install,
  };
}
```

**컴포넌트**: `src/components/pwa/InstallPrompt.tsx`

```
┌─────────────────────────────────────────────────┐
│ ┌─────┐                                    ✕   │
│ │ 📱  │  Asimaster를 홈 화면에 추가하세요       │
│ └─────┘  앱처럼 빠르게 접근할 수 있어요         │
│                                    [ 설치하기 ] │
└─────────────────────────────────────────────────┘
```

- 위치: 화면 하단 (MobileNav 위), fixed position
- 표시 조건: `canInstall === true` (브라우저에서 접속 + 미설치)
- 닫기: X 버튼 → localStorage에 "dismissed" 저장, 7일 후 재표시
- 스타일: `glass-card` + framer-motion 슬라이드업 애니메이션
- 모바일 전용: `md:hidden` (데스크톱에서 미표시)

### 3.6 오프라인 상태 배너 (R9)

**훅**: `src/hooks/useOnlineStatus.ts`

```typescript
"use client";
import { useState, useEffect } from "react";

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  return isOnline;
}
```

**컴포넌트**: `src/components/pwa/OfflineBanner.tsx`

```
┌─────────────────────────────────────────────────┐
│ ⚠️ 오프라인 상태입니다. 캐시된 데이터를 표시합니다 │
└─────────────────────────────────────────────────┘
```

- 위치: Header 바로 아래, 전체 너비
- 배경: `amber-500/90` (경고 색상)
- 표시/숨김: framer-motion AnimatePresence (슬라이드다운)
- 온라인 복귀 시: 자동 숨김 + "다시 연결되었습니다" 토스트 (Sonner)

### 3.7 웹 푸시 구독 (R8)

**훅**: `src/hooks/usePushSubscription.ts`

```
동작 흐름:

1. 컴포넌트 마운트
   → GET /push/vapid-public-key
   → VAPID 공개키 취득

2. 구독 토글 ON
   → Notification.requestPermission()
   → serviceWorkerRegistration.pushManager.subscribe({ applicationServerKey })
   → POST /push/subscribe { endpoint, keys: { p256dh, auth } }

3. 구독 토글 OFF
   → pushSubscription.unsubscribe()
   → DELETE /push/subscribe { endpoint }
```

**상태 관리:**
- `isSupported`: 브라우저 Push API 지원 여부
- `isSubscribed`: 현재 구독 상태
- `isLoading`: 구독/해제 처리 중
- `permission`: Notification.permission ("granted" | "denied" | "default")

**컴포넌트**: `src/components/pwa/PushToggle.tsx`

설정 페이지 내 카드로 표시:

```
┌─────────────────────────────────────────────────┐
│ 🔔 푸시 알림                                     │
│                                                  │
│ 가격 변동, 순위 하락 시 알림을 받습니다            │
│                                        [●━━━━━] │ ← Switch 토글
│                                                  │
│ ⓘ iOS 16.4 이상에서 지원됩니다                    │
└─────────────────────────────────────────────────┘
```

- 미지원 브라우저: "이 브라우저에서 푸시 알림이 지원되지 않습니다" 비활성 표시
- 권한 거부(denied): "알림이 차단되었습니다. 브라우저 설정에서 허용해주세요" 안내
- `@radix-ui/react-switch` 재사용 (이미 의존성 있음)

### 3.8 Service Worker 업데이트 알림 (R12)

**컴포넌트**: `src/components/pwa/ServiceWorkerUpdater.tsx`

```
동작 흐름:

1. SW 등록 후 'controllerchange' 이벤트 감지
2. 새 SW 대기(waiting) 상태 감지
3. Sonner 토스트: "새 버전이 있습니다" + [새로고침] 버튼
4. 버튼 클릭 → waiting SW에 skipWaiting 메시지 → window.location.reload()
```

- next-pwa의 `skipWaiting: true` 설정으로 대부분 자동 처리
- 추가 안전장치: 수동 새로고침 토스트 (드문 경우 대비)

### 3.9 설정 페이지 연동

**파일**: `src/app/settings/page.tsx` — 메뉴 항목 추가

```typescript
// 기존 SETTINGS_ITEMS에 추가
{
  href: "/settings/notifications",
  icon: Bell,
  label: "알림 설정",
  description: "푸시 알림 구독 및 알림 방식을 설정합니다",
}
```

**새 페이지**: `src/app/settings/notifications/page.tsx`
- `PushToggle` 컴포넌트 배치
- 향후 알림 세부 설정 확장 가능 (종류별 ON/OFF 등)

### 3.10 providers.tsx 통합

```typescript
export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        {children}
        <Toaster position="bottom-right" richColors />
        <OfflineBanner />
        <InstallPrompt />
        <ServiceWorkerUpdater />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
```

**배치 순서:**
1. `<OfflineBanner />` — Header 아래 고정 배너 (전체 화면 공통)
2. `<InstallPrompt />` — 하단 설치 유도 배너 (모바일 전용)
3. `<ServiceWorkerUpdater />` — 업데이트 토스트 (UI 없음, 이벤트 리스너만)

### 3.11 .gitignore 추가

```gitignore
# PWA build artifacts (next-pwa generated)
public/sw.js
public/sw.js.map
public/workbox-*.js
public/workbox-*.js.map
public/swe-worker-*.js
public/swe-worker-*.js.map
```

## 4. 구현 순서 (체크리스트)

### Phase 1: 설치 가능한 PWA 기본 (R1~R6)

- [ ] 1-1. `@ducanh2912/next-pwa` 설치 (`npm install`)
- [ ] 1-2. `next.config.ts` — `withPWA()` 설정 (§3.3)
- [ ] 1-3. `public/manifest.json` 생성 (§3.1)
- [ ] 1-4. 앱 아이콘 생성 및 `public/`에 배치 (§3.2)
- [ ] 1-5. `src/app/layout.tsx` — metadata + viewport 확장 (§3.4)
- [ ] 1-6. `.gitignore` — SW 빌드 산출물 제외 (§3.11)
- [ ] 1-7. 빌드 테스트 (`npm run build`) + Lighthouse PWA 점수 확인

### Phase 2: UX 강화 (R7~R9)

- [ ] 2-1. `src/hooks/usePWAInstall.ts` 훅 구현 (§3.5)
- [ ] 2-2. `src/components/pwa/InstallPrompt.tsx` 구현 (§3.5)
- [ ] 2-3. `src/hooks/useOnlineStatus.ts` 훅 구현 (§3.6)
- [ ] 2-4. `src/components/pwa/OfflineBanner.tsx` 구현 (§3.6)
- [ ] 2-5. `src/hooks/usePushSubscription.ts` 훅 구현 (§3.7)
- [ ] 2-6. `src/components/pwa/PushToggle.tsx` 구현 (§3.7)
- [ ] 2-7. `src/app/settings/notifications/page.tsx` 생성 (§3.9)
- [ ] 2-8. `src/app/settings/page.tsx` — 알림 설정 메뉴 추가 (§3.9)
- [ ] 2-9. `src/app/providers.tsx` — PWA 컴포넌트 통합 (§3.10)

### Phase 3: 부가 기능 (R10~R12)

- [ ] 3-1. `src/components/pwa/ServiceWorkerUpdater.tsx` 구현 (§3.8)
- [ ] 3-2. manifest.json shortcuts 검증 (§3.1)
- [ ] 3-3. 전체 E2E 검증 (설치 → 오프라인 → 푸시 → 업데이트)

## 5. 의존성

### 5.1 새 패키지

| 패키지 | 버전 | 용도 |
|--------|------|------|
| `@ducanh2912/next-pwa` | `^5.6.0` | Next.js 15 App Router PWA 플러그인 |

### 5.2 기존 재사용

| 패키지 | 용도 |
|--------|------|
| `@radix-ui/react-switch` | 푸시 구독 토글 |
| `framer-motion` | 배너 애니메이션 |
| `sonner` | 토스트 알림 (업데이트, 온라인 복귀) |
| `lucide-react` | 아이콘 (Bell, Wifi, WifiOff, Download) |
| `axios` | 푸시 구독 API 호출 |

## 6. 호환성 매트릭스

| 기능 | Chrome (Android) | Safari (iOS) | Samsung Internet | 비고 |
|------|:-----------------:|:------------:|:----------------:|------|
| 홈 화면 설치 | ✅ | ✅ | ✅ | |
| standalone 모드 | ✅ | ✅ | ✅ | |
| Service Worker | ✅ | ✅ | ✅ | |
| 오프라인 캐시 | ✅ | ✅ | ✅ | |
| 웹 푸시 알림 | ✅ | ⚠️ iOS 16.4+ | ✅ | iOS 이전 버전 미지원 |
| beforeinstallprompt | ✅ | ❌ | ✅ | iOS는 수동 안내 필요 |
| maskable 아이콘 | ✅ | ❌ | ✅ | iOS는 apple-touch-icon 사용 |

**iOS 대응:**
- `beforeinstallprompt` 미지원 → "공유 → 홈 화면에 추가" 수동 안내 문구 표시
- iOS 16.4 미만 웹 푸시 미지원 → PushToggle에서 비활성 안내

## 7. 백엔드 변경

**없음** — 웹 푸시 API 3개 엔드포인트 이미 완성:
- `GET /api/v1/push/vapid-public-key`
- `POST /api/v1/push/subscribe`
- `DELETE /api/v1/push/subscribe`
