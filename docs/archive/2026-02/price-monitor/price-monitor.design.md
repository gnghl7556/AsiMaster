# Price Monitor Design Document

> **Summary**: 경쟁사 가격 모니터링 솔루션의 기술 설계서
>
> **Project**: asimaster (Price Monitor)
> **Author**: PC
> **Date**: 2026-02-20
> **Status**: Draft
> **Plan Reference**: [price-monitor.plan.md](../../01-plan/features/price-monitor.plan.md)

---

## 1. Database Schema

### 1.1 ERD Overview

```
┌──────────┐     ┌───────────┐     ┌──────────────┐
│  users   │────<│ products  │────<│ competitors  │
│(사업체)   │     │(내 상품)   │     │(경쟁사 URL)   │
└──────────┘     └─────┬─────┘     └──────┬───────┘
     │                 │                   │
     │           ┌─────┴─────┐      ┌──────┴───────┐
     │           │cost_items │      │price_history │
     │           │(비용항목)  │      │(가격이력)     │
     │           └───────────┘      └──────────────┘
     │
     ├────<┌───────────────┐
     │     │user_platforms │
     │     │(플랫폼 설정)   │
     │     └───────┬───────┘
     │             │
     │     ┌───────┴───────┐
     │     │  platforms    │
     │     │(플랫폼 마스터) │
     │     └───────────────┘
     │
     ├────<┌───────────┐
     │     │  alerts   │
     │     │(알림)      │
     │     └───────────┘
     │
     └────<┌──────────────┐
           │cost_presets  │
           │(비용 프리셋)  │
           └──────────────┘
```

### 1.2 Table Definitions

#### `users` (사업체)

| Column | Type | Constraint | Description |
|--------|------|------------|-------------|
| `id` | SERIAL | PK | 사업체 ID |
| `name` | VARCHAR(100) | NOT NULL, UNIQUE | 사업체 이름 |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | 생성일시 |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | 수정일시 |

#### `platforms` (플랫폼 마스터)

| Column | Type | Constraint | Description |
|--------|------|------------|-------------|
| `id` | SERIAL | PK | 플랫폼 ID |
| `name` | VARCHAR(50) | NOT NULL, UNIQUE | 플랫폼명 (naver, coupang, gmarket, auction) |
| `display_name` | VARCHAR(50) | NOT NULL | 표시명 (네이버, 쿠팡, 지마켓, 옥션) |
| `base_url` | VARCHAR(255) | | 플랫폼 기본 URL |
| `is_default` | BOOLEAN | DEFAULT TRUE | 기본 제공 플랫폼 여부 |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | 생성일시 |

#### `user_platforms` (사용자별 플랫폼 설정)

| Column | Type | Constraint | Description |
|--------|------|------------|-------------|
| `id` | SERIAL | PK | 설정 ID |
| `user_id` | INTEGER | FK → users.id, NOT NULL | 사업체 ID |
| `platform_id` | INTEGER | FK → platforms.id, NOT NULL | 플랫폼 ID |
| `is_active` | BOOLEAN | DEFAULT TRUE | 활성화 여부 |
| `crawl_interval_min` | INTEGER | DEFAULT 60 | 크롤링 주기 (분) |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | 생성일시 |

> **UNIQUE**: (user_id, platform_id)

#### `products` (내 상품)

| Column | Type | Constraint | Description |
|--------|------|------------|-------------|
| `id` | SERIAL | PK | 상품 ID |
| `user_id` | INTEGER | FK → users.id, NOT NULL | 사업체 ID |
| `name` | VARCHAR(200) | NOT NULL | 상품명 |
| `category` | VARCHAR(100) | | 카테고리 |
| `cost_price` | INTEGER | NOT NULL | 매입원가 (원) |
| `selling_price` | INTEGER | NOT NULL | 판매가 (원) |
| `image_url` | VARCHAR(500) | | 상품 이미지 URL |
| `is_price_locked` | BOOLEAN | DEFAULT FALSE | 가격고정 여부 |
| `price_lock_reason` | VARCHAR(200) | | 가격고정 사유 |
| `is_active` | BOOLEAN | DEFAULT TRUE | 활성 상태 |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | 생성일시 |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | 수정일시 |

> **INDEX**: (user_id), (user_id, category), (user_id, is_price_locked)

#### `competitors` (경쟁사 상품)

| Column | Type | Constraint | Description |
|--------|------|------------|-------------|
| `id` | SERIAL | PK | 경쟁사 상품 ID |
| `product_id` | INTEGER | FK → products.id, NOT NULL | 내 상품 ID |
| `platform_id` | INTEGER | FK → platforms.id, NOT NULL | 플랫폼 ID |
| `url` | VARCHAR(1000) | NOT NULL | 경쟁사 상품 URL |
| `seller_name` | VARCHAR(200) | | 판매자명 |
| `is_active` | BOOLEAN | DEFAULT TRUE | 활성 상태 |
| `last_crawled_at` | TIMESTAMPTZ | | 마지막 크롤링 시각 |
| `crawl_status` | VARCHAR(20) | DEFAULT 'pending' | 크롤링 상태 (pending/success/failed) |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | 생성일시 |

> **INDEX**: (product_id), (platform_id), (crawl_status)

#### `price_history` (가격 이력)

| Column | Type | Constraint | Description |
|--------|------|------------|-------------|
| `id` | SERIAL | PK | 이력 ID |
| `competitor_id` | INTEGER | FK → competitors.id, NOT NULL | 경쟁사 상품 ID |
| `price` | INTEGER | NOT NULL | 가격 (원) |
| `shipping_fee` | INTEGER | DEFAULT 0 | 배송비 (원) |
| `total_price` | INTEGER | NOT NULL | 총액 (가격+배송비) |
| `ranking` | INTEGER | | 노출 순위 |
| `total_sellers` | INTEGER | | 총 판매자 수 |
| `crawled_at` | TIMESTAMPTZ | DEFAULT NOW(), NOT NULL | 수집 시각 |

> **INDEX**: (competitor_id, crawled_at DESC) - 최신 가격 조회 최적화
> **PARTITION**: crawled_at 기준 월별 파티셔닝 고려 (데이터 증가 시)

#### `cost_items` (비용 항목)

| Column | Type | Constraint | Description |
|--------|------|------------|-------------|
| `id` | SERIAL | PK | 비용 항목 ID |
| `product_id` | INTEGER | FK → products.id, NOT NULL | 상품 ID |
| `name` | VARCHAR(100) | NOT NULL | 비용명 (수수료, 포인트, 광고비 등) |
| `type` | VARCHAR(20) | NOT NULL | 타입: 'percent' / 'fixed' |
| `value` | DECIMAL(10,2) | NOT NULL | 값 (퍼센트 또는 금액) |
| `sort_order` | INTEGER | DEFAULT 0 | 표시 순서 |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | 생성일시 |

> **INDEX**: (product_id)

#### `cost_presets` (비용 프리셋)

| Column | Type | Constraint | Description |
|--------|------|------------|-------------|
| `id` | SERIAL | PK | 프리셋 ID |
| `user_id` | INTEGER | FK → users.id, NOT NULL | 사업체 ID |
| `name` | VARCHAR(100) | NOT NULL | 프리셋명 (예: "네이버 수수료") |
| `items` | JSONB | NOT NULL | 비용 항목 배열 |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | 생성일시 |

> **items JSONB 구조**: `[{"name": "수수료", "type": "percent", "value": 5.5}, ...]`

#### `alerts` (알림)

| Column | Type | Constraint | Description |
|--------|------|------------|-------------|
| `id` | SERIAL | PK | 알림 ID |
| `user_id` | INTEGER | FK → users.id, NOT NULL | 사업체 ID |
| `product_id` | INTEGER | FK → products.id | 관련 상품 (NULL=전체) |
| `type` | VARCHAR(30) | NOT NULL | 알림 유형: 'price_undercut', 'new_competitor', 'price_surge' |
| `title` | VARCHAR(200) | NOT NULL | 알림 제목 |
| `message` | TEXT | | 알림 내용 |
| `is_read` | BOOLEAN | DEFAULT FALSE | 읽음 여부 |
| `data` | JSONB | | 추가 데이터 (변동 전/후 가격 등) |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | 생성일시 |

> **INDEX**: (user_id, is_read, created_at DESC)

#### `alert_settings` (알림 설정)

| Column | Type | Constraint | Description |
|--------|------|------------|-------------|
| `id` | SERIAL | PK | 설정 ID |
| `user_id` | INTEGER | FK → users.id, NOT NULL | 사업체 ID |
| `alert_type` | VARCHAR(30) | NOT NULL | 알림 유형 |
| `is_enabled` | BOOLEAN | DEFAULT TRUE | 활성화 여부 |
| `threshold` | DECIMAL(10,2) | | 임계값 (가격 급변동 %) |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | 생성일시 |

> **UNIQUE**: (user_id, alert_type)

#### `crawl_logs` (크롤링 로그)

| Column | Type | Constraint | Description |
|--------|------|------------|-------------|
| `id` | SERIAL | PK | 로그 ID |
| `competitor_id` | INTEGER | FK → competitors.id | 경쟁사 상품 ID |
| `platform_id` | INTEGER | FK → platforms.id, NOT NULL | 플랫폼 ID |
| `status` | VARCHAR(20) | NOT NULL | 상태: 'success', 'failed', 'blocked' |
| `error_message` | TEXT | | 에러 메시지 |
| `duration_ms` | INTEGER | | 처리 시간 (ms) |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | 생성일시 |

> **INDEX**: (platform_id, created_at DESC), (status)

---

## 2. API Design

### 2.1 Base Configuration

- **Base URL**: `/api/v1`
- **Format**: JSON
- **Error Response**: `{ "detail": "error message" }`
- **Pagination**: `?page=1&size=20` → `{ "items": [], "total": 100, "page": 1, "size": 20, "pages": 5 }`

### 2.2 Endpoints

#### Users (사업체)

| Method | Path | Description | Request Body | Response |
|--------|------|-------------|-------------|----------|
| `GET` | `/users` | 사업체 목록 조회 | - | `User[]` |
| `POST` | `/users` | 사업체 생성 | `{ name }` | `User` |
| `GET` | `/users/{id}` | 사업체 상세 조회 | - | `User` |
| `PUT` | `/users/{id}` | 사업체 수정 | `{ name }` | `User` |
| `DELETE` | `/users/{id}` | 사업체 삭제 | - | `204` |

#### Products (상품)

| Method | Path | Description | Request Body | Response |
|--------|------|-------------|-------------|----------|
| `GET` | `/users/{userId}/products` | 상품 목록 (정렬/필터 포함) | - | `ProductListItem[]` |
| `POST` | `/users/{userId}/products` | 상품 등록 | `ProductCreate` | `Product` |
| `GET` | `/users/{userId}/products/{id}` | 상품 상세 (경쟁사+가격 포함) | - | `ProductDetail` |
| `PUT` | `/users/{userId}/products/{id}` | 상품 수정 | `ProductUpdate` | `Product` |
| `DELETE` | `/users/{userId}/products/{id}` | 상품 삭제 | - | `204` |
| `PATCH` | `/users/{userId}/products/{id}/price-lock` | 가격고정 토글 | `{ is_locked, reason? }` | `Product` |

**Query Parameters** (상품 목록):

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `sort` | string | `urgency` | 정렬: `urgency`, `margin`, `rank_drop`, `category` |
| `category` | string | - | 카테고리 필터 |
| `search` | string | - | 상품명 검색 |
| `price_locked` | boolean | - | 가격고정 필터 |
| `page` | int | 1 | 페이지 |
| `size` | int | 20 | 페이지 크기 |

#### Competitors (경쟁사)

| Method | Path | Description | Request Body | Response |
|--------|------|-------------|-------------|----------|
| `GET` | `/products/{productId}/competitors` | 경쟁사 목록 | - | `Competitor[]` |
| `POST` | `/products/{productId}/competitors` | 경쟁사 등록 | `{ platform_id, url }` | `Competitor` |
| `PUT` | `/competitors/{id}` | 경쟁사 수정 | `{ url, is_active }` | `Competitor` |
| `DELETE` | `/competitors/{id}` | 경쟁사 삭제 | - | `204` |

#### Price History (가격 이력)

| Method | Path | Description | Response |
|--------|------|-------------|----------|
| `GET` | `/products/{productId}/price-history` | 가격 추이 (차트 데이터) | `PriceHistoryPoint[]` |
| `GET` | `/products/{productId}/price-snapshot` | 현재 가격 스냅샷 (전 플랫폼) | `PriceSnapshot` |

**Query Parameters** (가격 추이):

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `period` | string | `7d` | 기간: `1d`, `7d`, `30d` |
| `platform_id` | int | - | 플랫폼 필터 |

#### Cost & Margin (비용/마진)

| Method | Path | Description | Request Body | Response |
|--------|------|-------------|-------------|----------|
| `GET` | `/products/{productId}/costs` | 비용 항목 조회 | - | `CostItem[]` |
| `PUT` | `/products/{productId}/costs` | 비용 항목 일괄 저장 | `CostItem[]` | `CostItem[]` |
| `GET` | `/products/{productId}/margin` | 마진 계산 결과 | - | `MarginResult` |
| `POST` | `/products/{productId}/margin/simulate` | 마진 시뮬레이션 | `{ selling_price }` | `MarginResult` |
| `GET` | `/users/{userId}/cost-presets` | 비용 프리셋 목록 | - | `CostPreset[]` |
| `POST` | `/users/{userId}/cost-presets` | 프리셋 생성 | `CostPresetCreate` | `CostPreset` |
| `DELETE` | `/cost-presets/{id}` | 프리셋 삭제 | - | `204` |

#### Platforms (플랫폼)

| Method | Path | Description | Response |
|--------|------|-------------|----------|
| `GET` | `/platforms` | 전체 플랫폼 목록 | `Platform[]` |
| `GET` | `/users/{userId}/platforms` | 사용자 플랫폼 설정 | `UserPlatform[]` |
| `PUT` | `/users/{userId}/platforms/{platformId}` | 플랫폼 설정 변경 | `UserPlatform` |

#### Alerts (알림)

| Method | Path | Description | Response |
|--------|------|-------------|----------|
| `GET` | `/users/{userId}/alerts` | 알림 목록 | `Alert[]` (Paginated) |
| `PATCH` | `/alerts/{id}/read` | 알림 읽음 처리 | `Alert` |
| `POST` | `/alerts/read-all` | 전체 읽음 처리 | `204` |
| `GET` | `/users/{userId}/alert-settings` | 알림 설정 조회 | `AlertSetting[]` |
| `PUT` | `/users/{userId}/alert-settings` | 알림 설정 변경 | `AlertSetting[]` |

#### Crawling (크롤링)

| Method | Path | Description | Response |
|--------|------|-------------|----------|
| `POST` | `/crawl/product/{productId}` | 특정 상품 수동 크롤링 | `CrawlResult` |
| `POST` | `/crawl/user/{userId}` | 사업체 전체 수동 크롤링 | `CrawlBatchResult` |
| `GET` | `/crawl/status/{userId}` | 크롤링 상태 조회 | `CrawlStatus` |
| `GET` | `/crawl/logs/{userId}` | 크롤링 로그 | `CrawlLog[]` (Paginated) |

#### Dashboard (대시보드)

| Method | Path | Description | Response |
|--------|------|-------------|----------|
| `GET` | `/users/{userId}/dashboard/summary` | 대시보드 요약 | `DashboardSummary` |
| `GET` | `/users/{userId}/dashboard/export` | CSV 내보내기 | `text/csv` |

### 2.3 Key Response Schemas

#### ProductListItem (상품 목록 아이템 - 핵심 뷰)

```json
{
  "id": 1,
  "name": "에어팟 프로2",
  "category": "이어폰",
  "selling_price": 219000,
  "cost_price": 168000,
  "image_url": "https://...",
  "is_price_locked": false,
  "price_lock_reason": null,
  "status": "losing",           // "winning" | "close" | "losing"
  "lowest_price": 209000,
  "lowest_platform": "쿠팡",
  "lowest_shipping_fee": 0,
  "price_gap": 10000,           // 내 가격 - 최저가 (양수=비쌈)
  "price_gap_percent": 4.8,
  "ranking": 3,
  "total_sellers": 5,
  "margin_amount": 15800,
  "margin_percent": 7.2,
  "sparkline": [209000, 210000, 209500, 209000, 211000, 209000, 209000],
  "last_crawled_at": "2026-02-20T10:30:00Z"
}
```

#### ProductDetail (상품 상세)

```json
{
  "id": 1,
  "name": "에어팟 프로2",
  "category": "이어폰",
  "selling_price": 219000,
  "cost_price": 168000,
  "image_url": "https://...",
  "is_price_locked": false,
  "status": "losing",
  "lowest_price": 209000,
  "lowest_platform": "쿠팡",
  "price_gap": 10000,
  "price_gap_percent": 4.8,
  "ranking": 3,
  "total_sellers": 5,
  "last_crawled_at": "2026-02-20T10:30:00Z",
  "competitors": [
    {
      "id": 1,
      "platform": "쿠팡",
      "seller_name": "쿠팡 직영",
      "price": 209000,
      "shipping_fee": 0,
      "total_price": 209000,
      "ranking": 1,
      "is_lowest": true,
      "gap_from_lowest": 0,
      "crawled_at": "2026-02-20T10:30:00Z"
    }
  ],
  "margin": {
    "selling_price": 219000,
    "cost_price": 168000,
    "total_costs": 35200,
    "cost_items": [
      { "name": "수수료", "type": "percent", "value": 5.5, "calculated": 12045 },
      { "name": "포인트", "type": "percent", "value": 2.8, "calculated": 6132 },
      { "name": "광고비", "type": "fixed", "value": 10000, "calculated": 10000 },
      { "name": "배송비", "type": "fixed", "value": 3500, "calculated": 3500 },
      { "name": "기타", "type": "fixed", "value": 3000, "calculated": 3000 }
    ],
    "net_margin": 15800,
    "margin_percent": 7.2
  }
}
```

#### DashboardSummary (대시보드 요약)

```json
{
  "total_products": 5,
  "active_products": 3,
  "price_locked_products": 2,
  "status_counts": {
    "winning": 1,
    "close": 1,
    "losing": 1
  },
  "avg_margin_percent": 9.3,
  "unread_alerts": 3,
  "last_crawled_at": "2026-02-20T10:30:00Z",
  "crawl_success_rate": 96.5
}
```

---

## 3. Frontend Architecture

### 3.1 Page Structure (App Router)

```
src/app/
├── layout.tsx                 # Root Layout (헤더 + 사이드바)
├── page.tsx                   # / → /dashboard redirect
├── dashboard/
│   └── page.tsx               # 대시보드 (메인)
├── products/
│   ├── page.tsx               # 상품 목록 (핵심 뷰 FR-08)
│   ├── new/
│   │   └── page.tsx           # 상품 등록
│   └── [id]/
│       ├── page.tsx           # 상품 상세 (경쟁 상황 + 마진)
│       └── competitors/
│           └── page.tsx       # 경쟁사 관리
├── alerts/
│   └── page.tsx               # 알림 목록
├── settings/
│   ├── page.tsx               # 설정 메인
│   ├── platforms/
│   │   └── page.tsx           # 플랫폼 설정
│   └── cost-presets/
│       └── page.tsx           # 비용 프리셋 관리
└── not-found.tsx
```

### 3.2 Component Architecture

```
src/components/
├── layout/
│   ├── Header.tsx             # 헤더 (사업체 드롭다운 포함)
│   ├── Sidebar.tsx            # 사이드바 (PC)
│   ├── MobileNav.tsx          # 모바일 하단 네비게이션
│   └── ThemeToggle.tsx        # 다크/라이트 전환
│
├── products/
│   ├── ProductList.tsx        # 상품 리스트 (핵심 뷰 컨테이너)
│   ├── ProductCard.tsx        # 상품 카드 (Glassmorphism)
│   ├── ProductCardMobile.tsx  # 모바일 간결 카드
│   ├── ProductDetail.tsx      # 상품 상세 뷰
│   ├── StatusBadge.tsx        # 신호등 배지 (🟢🟡🔴)
│   ├── PriceGap.tsx           # 가격 차이 (동적 타이포그래피)
│   ├── MarginBar.tsx          # 마진율 프로그레스 바
│   ├── MarginDetail.tsx       # 마진 상세 (접힘/펼침)
│   ├── CompetitorRanking.tsx  # 경쟁사 순위 리스트
│   ├── PriceLockSection.tsx   # 가격고정 섹션
│   ├── PriceLockToggle.tsx    # 가격고정 토글 + 사유
│   ├── SortDropdown.tsx       # 정렬 옵션 드롭다운
│   ├── SummaryBar.tsx         # 요약바 (관리 중 N개, 가격고정 N개)
│   ├── SparklineChart.tsx     # 인라인 미니 차트
│   └── ProductForm.tsx        # 상품 등록/수정 폼
│
├── dashboard/
│   ├── DashboardSummary.tsx   # 대시보드 요약 카드
│   ├── PriceCompareTable.tsx  # 가격 비교 테이블
│   ├── PriceTrendChart.tsx    # 가격 추이 차트 (Recharts)
│   └── RankingChart.tsx       # 순위 변동 차트
│
├── alerts/
│   ├── AlertList.tsx          # 알림 목록
│   ├── AlertItem.tsx          # 알림 아이템
│   └── AlertSettings.tsx      # 알림 설정
│
├── competitors/
│   ├── CompetitorList.tsx     # 경쟁사 목록
│   ├── CompetitorForm.tsx     # 경쟁사 등록 폼
│   └── CompetitorUrlInput.tsx # URL 입력 (플랫폼 자동 감지)
│
├── settings/
│   ├── PlatformToggle.tsx     # 플랫폼 ON/OFF 토글
│   ├── CostPresetForm.tsx     # 비용 프리셋 폼
│   └── CostItemEditor.tsx     # 비용 항목 편집기
│
└── ui/                        # shadcn/ui 기반 공통 컴포넌트
    ├── AnimatedNumber.tsx     # 숫자 카운트업 (react-countup)
    ├── GlassCard.tsx          # Glassmorphism 카드
    ├── SkeletonCard.tsx       # 스켈레톤 로딩
    ├── Toast.tsx              # 토스트 (Sonner)
    └── CollapsibleSection.tsx # 접힘/펼침 섹션
```

### 3.3 State Management (Zustand)

```
src/stores/
├── useUserStore.ts            # 선택된 사업체 상태
├── useProductStore.ts         # 상품 리스트 필터/정렬 상태
└── useThemeStore.ts           # 테마 (다크/라이트)
```

#### useUserStore

```typescript
interface UserStore {
  currentUserId: number | null;
  users: User[];
  setCurrentUser: (id: number) => void;
  fetchUsers: () => Promise<void>;
}
```

#### useProductStore

```typescript
interface ProductStore {
  sortBy: 'urgency' | 'margin' | 'rank_drop' | 'category';
  category: string | null;
  search: string;
  setSortBy: (sort: SortOption) => void;
  setCategory: (cat: string | null) => void;
  setSearch: (q: string) => void;
}
```

### 3.4 API Client (TanStack Query + Axios)

```
src/lib/
├── api/
│   ├── client.ts              # Axios 인스턴스 (baseURL, interceptors)
│   ├── users.ts               # User API 함수
│   ├── products.ts            # Product API 함수
│   ├── competitors.ts         # Competitor API 함수
│   ├── prices.ts              # Price History API 함수
│   ├── costs.ts               # Cost & Margin API 함수
│   ├── alerts.ts              # Alert API 함수
│   ├── platforms.ts           # Platform API 함수
│   └── crawl.ts               # Crawl API 함수
│
├── hooks/
│   ├── useProducts.ts         # useQuery: 상품 목록/상세
│   ├── useCompetitors.ts      # useQuery: 경쟁사 목록
│   ├── usePriceHistory.ts     # useQuery: 가격 추이
│   ├── useMargin.ts           # useQuery/useMutation: 마진 계산
│   ├── useAlerts.ts           # useQuery: 알림
│   ├── useCrawl.ts            # useMutation: 수동 크롤링
│   └── useDashboard.ts        # useQuery: 대시보드 요약
│
└── utils/
    ├── format.ts              # 가격 포맷 (1,000원), 퍼센트 포맷
    ├── status.ts              # 상태 계산 (winning/close/losing)
    └── constants.ts           # 상수 (색상 코드, 임계값 등)
```

#### TanStack Query 키 전략

```typescript
const queryKeys = {
  users: ['users'] as const,
  products: {
    all: (userId: number) => ['products', userId] as const,
    detail: (userId: number, productId: number) => ['products', userId, productId] as const,
  },
  priceHistory: (productId: number, period: string) => ['priceHistory', productId, period] as const,
  competitors: (productId: number) => ['competitors', productId] as const,
  margin: (productId: number) => ['margin', productId] as const,
  alerts: (userId: number) => ['alerts', userId] as const,
  dashboard: (userId: number) => ['dashboard', userId] as const,
};
```

---

## 4. Backend Architecture

### 4.1 Module Structure

```
backend/app/
├── main.py                    # FastAPI app 생성, 미들웨어, 라우터 등록
├── core/
│   ├── config.py              # Settings (환경변수, DB URL 등)
│   ├── database.py            # SQLAlchemy async engine, session
│   └── deps.py                # Dependency injection (get_db 등)
│
├── models/                    # SQLAlchemy ORM 모델
│   ├── user.py
│   ├── platform.py
│   ├── product.py
│   ├── competitor.py
│   ├── price_history.py
│   ├── cost.py
│   ├── alert.py
│   └── crawl_log.py
│
├── schemas/                   # Pydantic 스키마 (Request/Response)
│   ├── user.py
│   ├── product.py
│   ├── competitor.py
│   ├── price.py
│   ├── cost.py
│   ├── alert.py
│   ├── crawl.py
│   └── dashboard.py
│
├── api/                       # API 라우터
│   ├── router.py              # 메인 라우터 (v1 prefix)
│   ├── users.py
│   ├── products.py
│   ├── competitors.py
│   ├── prices.py
│   ├── costs.py
│   ├── alerts.py
│   ├── platforms.py
│   ├── crawl.py
│   └── dashboard.py
│
├── services/                  # 비즈니스 로직
│   ├── product_service.py     # 상품 관련 로직 (긴급도 정렬 등)
│   ├── margin_service.py      # 마진 계산 로직
│   ├── alert_service.py       # 알림 생성/발송 로직
│   └── dashboard_service.py   # 대시보드 집계 로직
│
├── crawlers/                  # 크롤링 엔진
│   ├── base.py                # BaseCrawler 추상 클래스
│   ├── naver.py               # 네이버 크롤러
│   ├── coupang.py             # 쿠팡 크롤러
│   ├── gmarket.py             # 지마켓 크롤러
│   ├── auction.py             # 옥션 크롤러
│   ├── registry.py            # CrawlerRegistry (팩토리)
│   └── manager.py             # CrawlManager (실행 관리)
│
└── scheduler/
    ├── jobs.py                # 스케줄러 작업 정의
    └── setup.py               # APScheduler 초기화
```

### 4.2 Crawling Engine Design

#### BaseCrawler (추상 클래스)

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass

@dataclass
class CrawlResult:
    price: int                   # 가격
    shipping_fee: int = 0        # 배송비
    seller_name: str | None = None
    ranking: int | None = None
    total_sellers: int | None = None
    success: bool = True
    error: str | None = None

class BaseCrawler(ABC):
    platform_name: str           # 플랫폼 식별자

    @abstractmethod
    async def fetch(self, url: str) -> CrawlResult:
        """URL에서 가격/배송비 수집"""
        pass

    def validate_url(self, url: str) -> bool:
        """URL이 해당 플랫폼 것인지 검증"""
        pass

    async def _get_page(self, url: str) -> str:
        """Playwright로 페이지 HTML 가져오기 (공통)"""
        pass

    def _parse_price(self, text: str) -> int:
        """가격 문자열 → 정수 변환 (공통)"""
        pass
```

#### CrawlerRegistry (팩토리)

```python
class CrawlerRegistry:
    _crawlers: dict[str, type[BaseCrawler]] = {}

    @classmethod
    def register(cls, platform: str, crawler_cls: type[BaseCrawler]):
        cls._crawlers[platform] = crawler_cls

    @classmethod
    def get(cls, platform: str) -> BaseCrawler:
        return cls._crawlers[platform]()

    @classmethod
    def get_all(cls) -> list[BaseCrawler]:
        return [c() for c in cls._crawlers.values()]
```

#### CrawlManager (실행 관리)

```python
class CrawlManager:
    async def crawl_product(self, product_id: int) -> list[CrawlResult]:
        """특정 상품의 모든 경쟁사 크롤링"""
        # 1. 상품의 활성 경쟁사 조회
        # 2. 플랫폼별 크롤러로 가격 수집
        # 3. price_history 저장
        # 4. 알림 조건 체크 → 알림 생성
        # 5. crawl_log 기록
        pass

    async def crawl_user_all(self, user_id: int) -> dict:
        """사업체 전체 상품 크롤링"""
        # 활성 상품 순회, crawl_product 호출
        pass
```

#### Anti-Blocking Strategy

| 전략 | 구현 |
|------|------|
| User-Agent 로테이션 | 요청마다 랜덤 UA 선택 (10종 이상) |
| 요청 간격 | 같은 플랫폼 내 2~5초 랜덤 딜레이 |
| Playwright 활용 | JS 렌더링 필요 페이지 대응 |
| 에러 핸들링 | 3회 재시도, 실패 시 crawl_log에 기록 |
| 쿠팡 특별 처리 | 더 긴 딜레이 (5~10초), 세션 유지 |

### 4.3 Scheduler Design

```python
# APScheduler 작업
jobs = [
    {
        "id": "crawl_scheduled",
        "func": crawl_all_users,
        "trigger": "interval",
        "minutes": 60,       # 기본 1시간 (user_platforms.crawl_interval_min 참조)
        "misfire_grace_time": 300,
    }
]
```

**스케줄링 로직**:
1. 기본 1시간 간격으로 전체 크롤링 Job 실행
2. Job 내에서 사용자별 플랫폼 크롤링 주기 확인
3. `last_crawled_at` + `crawl_interval_min` > 현재시각인 경쟁사만 크롤링
4. 비동기 실행으로 병렬 처리

### 4.4 Alert Logic

```
크롤링 완료 후 → Alert 체크:

1. price_undercut (최저가 이탈)
   - 조건: 내 판매가 > 최저가 (이전에는 1등이었거나 처음 감지)
   - 제외: is_price_locked = true인 상품

2. new_competitor (신규 경쟁자)
   - 조건: 이전 크롤링에 없던 판매자 발견 (total_sellers 증가)

3. price_surge (가격 급변동)
   - 조건: |이전가격 - 현재가격| / 이전가격 > threshold%
   - threshold: alert_settings에서 사용자 설정 (기본 10%)
```

---

## 5. UI/UX Design Specifications

### 5.1 Color System

#### Status Colors

| Status | Light Mode | Dark Mode | Usage |
|--------|-----------|-----------|-------|
| Winning (1등) | `#10B981` (emerald-500) | `#34D399` (emerald-400) | 배지, 테두리 글로우 |
| Close (근접) | `#F59E0B` (amber-500) | `#FBBF24` (amber-400) | 배지, 테두리 글로우 |
| Losing (밀림) | `#EF4444` (red-500) | `#F87171` (red-400) | 배지, 테두리 글로우 |
| Locked (고정) | `#6B7280` (gray-500) | `#9CA3AF` (gray-400) | 배지, 잠금 아이콘 |

#### Status Criteria

| Status | Condition |
|--------|-----------|
| `winning` | 내 가격 = 최저가 (1등) |
| `close` | 2등이면서 최저가 대비 3% 이내 |
| `losing` | 그 외 (2등 3% 초과 또는 3등 이하) |

### 5.2 Typography Scale (가격 표시)

| Element | Font Size (PC) | Font Size (Mobile) | Weight |
|---------|---------------|-------------------|--------|
| Price Gap (차이) | 24px | 18px | Bold (700) |
| Price (가격) | 18px | 16px | Semibold (600) |
| Margin | 14px | 13px | Medium (500) |
| Label | 12px | 11px | Regular (400) |

### 5.3 Glassmorphism Card Style

```css
/* Light Mode */
.glass-card {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 16px;
  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.05);
}

/* Dark Mode */
.glass-card-dark {
  background: rgba(30, 30, 30, 0.7);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.3);
}

/* Status Glow (Losing 예시) */
.glass-card[data-status="losing"] {
  border-color: rgba(239, 68, 68, 0.4);
  box-shadow: 0 0 20px rgba(239, 68, 68, 0.15);
}
```

### 5.4 Animation Specifications

| Animation | Library | Duration | Easing |
|-----------|---------|----------|--------|
| Layout reorder (정렬 변경) | Framer Motion `layout` | 300ms | easeInOut |
| Number count-up | react-countup | 500ms | easeOut |
| Card expand (상세 전환) | Framer Motion `AnimatePresence` | 250ms | easeOut |
| Collapse/Expand | Framer Motion `animate` height | 200ms | easeInOut |
| Price change highlight | CSS keyframe | 1500ms | flash + fadeOut |
| Toast notification | Sonner | 300ms (in), 200ms (out) | spring |
| Skeleton shimmer | CSS keyframe | 1500ms | infinite linear |

### 5.5 Responsive Breakpoints

| Breakpoint | Width | Layout |
|------------|-------|--------|
| Mobile | < 768px | 1열, 하단 네비게이션, 간결 카드 |
| Tablet | 768px ~ 1024px | 2열 그리드, 사이드바 접힘 |
| Desktop | > 1024px | 사이드바 + 메인 콘텐츠, 풀 카드 |

---

## 6. Data Flow

### 6.1 핵심 데이터 흐름: 상품 목록 조회

```
[사용자 접속]
    │
    ▼
[useUserStore] → currentUserId 확인
    │
    ▼
[GET /users/{userId}/products?sort=urgency]
    │
    ▼
[Backend: ProductService.get_product_list()]
    ├── products 테이블 조회
    ├── 각 상품의 최신 price_history 조인
    ├── 최저가, 순위, status 계산
    ├── margin 계산 (cost_items 합산)
    ├── sparkline 데이터 (최근 7일)
    └── 긴급도 정렬 적용
    │
    ▼
[Response: ProductListItem[]]
    │
    ▼
[ProductList Component]
    ├── 관리 중 섹션 (is_price_locked = false)
    │   ├── ProductCard (PC) / ProductCardMobile
    │   └── StatusBadge + PriceGap + MarginBar + SparklineChart
    │
    └── 가격고정 섹션 (is_price_locked = true)
        └── PriceLockSection (Collapsible)
```

### 6.2 크롤링 → 알림 데이터 흐름

```
[APScheduler: 크롤링 Job 실행]
    │
    ▼
[CrawlManager.crawl_user_all(userId)]
    │
    ├── 각 상품별 활성 경쟁사 조회
    │
    ▼
[CrawlerRegistry.get(platform).fetch(url)]
    ├── NaverCrawler   → Playwright + BS4 파싱
    ├── CoupangCrawler → Playwright + BS4 파싱
    ├── GmarketCrawler → Playwright + BS4 파싱
    └── AuctionCrawler → Playwright + BS4 파싱
    │
    ▼
[CrawlResult → price_history INSERT]
    │
    ▼
[AlertService.check_and_create()]
    ├── 최저가 이탈 체크 → alert 생성
    ├── 신규 경쟁자 체크 → alert 생성
    └── 급변동 체크 → alert 생성
    │
    ▼
[Web Push 발송 (해당 시)]
```

### 6.3 마진 시뮬레이션 흐름

```
[사용자: 판매가 변경 입력]
    │
    ▼
[POST /products/{id}/margin/simulate { selling_price: 215000 }]
    │
    ▼
[MarginService.simulate()]
    ├── 현재 cost_items 조회
    ├── 수수료(%) 항목: 새 판매가 기준 재계산
    ├── 고정(원) 항목: 그대로 유지
    └── 순마진 = 새 판매가 - 매입가 - 비용합계
    │
    ▼
[Response: MarginResult (시뮬레이션)]
    │
    ▼
[UI: 현재 마진 vs 시뮬레이션 마진 비교 표시]
```

---

## 7. Implementation Order

### Phase 1: 프로젝트 기반 (M1)

| # | Task | Files | Dependency |
|---|------|-------|------------|
| 1.1 | Next.js 프로젝트 초기화 (App Router, Tailwind v4, shadcn/ui) | `frontend/` | - |
| 1.2 | FastAPI 프로젝트 초기화 (async SQLAlchemy, Alembic) | `backend/` | - |
| 1.3 | PostgreSQL DB 스키마 생성 (Alembic migration) | `backend/models/`, `alembic/` | 1.2 |
| 1.4 | Seed data: 기본 플랫폼 4개 등록 | `backend/` | 1.3 |
| 1.5 | Users API + 헤더 사업체 드롭다운 UI | `api/users.py`, `Header.tsx` | 1.1, 1.3 |
| 1.6 | Zustand 스토어 + Axios 클라이언트 설정 | `stores/`, `lib/api/` | 1.1 |
| 1.7 | 레이아웃 (Header, Sidebar, MobileNav, ThemeToggle) | `components/layout/` | 1.1 |

### Phase 2: 상품/경쟁사 관리 (M2)

| # | Task | Files | Dependency |
|---|------|-------|------------|
| 2.1 | Products CRUD API | `api/products.py`, `services/product_service.py` | 1.3 |
| 2.2 | Competitors CRUD API | `api/competitors.py` | 1.3 |
| 2.3 | Platforms API + 플랫폼 설정 UI | `api/platforms.py`, `PlatformToggle.tsx` | 1.4, 1.5 |
| 2.4 | 상품 등록/수정 폼 UI | `ProductForm.tsx` | 2.1 |
| 2.5 | 경쟁사 등록 UI (URL 입력 + 플랫폼 자동 감지) | `CompetitorForm.tsx`, `CompetitorUrlInput.tsx` | 2.2, 2.3 |
| 2.6 | 비용 항목 CRUD API + UI | `api/costs.py`, `CostItemEditor.tsx` | 2.1 |
| 2.7 | 비용 프리셋 CRUD API + UI | `CostPresetForm.tsx` | 2.6 |

### Phase 3: 크롤링 엔진 (M3)

| # | Task | Files | Dependency |
|---|------|-------|------------|
| 3.1 | BaseCrawler 추상 클래스 구현 | `crawlers/base.py` | - |
| 3.2 | NaverCrawler 구현 | `crawlers/naver.py` | 3.1 |
| 3.3 | GmarketCrawler 구현 | `crawlers/gmarket.py` | 3.1 |
| 3.4 | CoupangCrawler 구현 | `crawlers/coupang.py` | 3.1 |
| 3.5 | AuctionCrawler 구현 | `crawlers/auction.py` | 3.1 |
| 3.6 | CrawlerRegistry + CrawlManager | `crawlers/registry.py`, `crawlers/manager.py` | 3.2~3.5 |
| 3.7 | Crawl API (수동 크롤링) | `api/crawl.py` | 3.6 |
| 3.8 | APScheduler 설정 + 스케줄링 | `scheduler/` | 3.6 |

### Phase 4: 핵심 뷰 대시보드 (M4)

| # | Task | Files | Dependency |
|---|------|-------|------------|
| 4.1 | ProductListItem API (긴급도 정렬 + 집계 쿼리) | `services/product_service.py` | 2.1, 3.6 |
| 4.2 | StatusBadge + PriceGap + MarginBar 컴포넌트 | 각 컴포넌트 | 1.1 |
| 4.3 | ProductCard (Glassmorphism) + ProductCardMobile | 각 컴포넌트 | 4.2 |
| 4.4 | ProductList (정렬, 필터, 요약바) | `ProductList.tsx` | 4.1, 4.3 |
| 4.5 | PriceLockSection (가격고정 영역) | `PriceLockSection.tsx` | 4.3 |
| 4.6 | ProductDetail (경쟁사 순위 + 마진 상세) | `ProductDetail.tsx` | 4.1 |
| 4.7 | SparklineChart (인라인 미니 차트) | `SparklineChart.tsx` | 가격 데이터 |
| 4.8 | Price History API + PriceTrendChart | `api/prices.py`, `PriceTrendChart.tsx` | 3.6 |
| 4.9 | RankingChart (순위 변동) | `RankingChart.tsx` | 4.8 |
| 4.10 | DashboardSummary (요약 카드) | `DashboardSummary.tsx` | 4.1 |

### Phase 5: 수익성 관리 (M5)

| # | Task | Files | Dependency |
|---|------|-------|------------|
| 5.1 | MarginService 구현 (계산 로직) | `services/margin_service.py` | 2.6 |
| 5.2 | Margin API + Simulate API | `api/costs.py` | 5.1 |
| 5.3 | MarginDetail 컴포넌트 (접힘/펼침) | `MarginDetail.tsx` | 5.2 |
| 5.4 | 시뮬레이션 UI (가격 변경 → 마진 미리보기) | `ProductDetail.tsx` 확장 | 5.2 |

### Phase 6: 알림 시스템 (M6)

| # | Task | Files | Dependency |
|---|------|-------|------------|
| 6.1 | AlertService 구현 (알림 생성 로직) | `services/alert_service.py` | 3.6 |
| 6.2 | Alert API | `api/alerts.py` | 6.1 |
| 6.3 | Web Push 설정 (VAPID, Service Worker) | `backend/core/`, `frontend/public/sw.js` | - |
| 6.4 | AlertList + AlertItem UI | 각 컴포넌트 | 6.2 |
| 6.5 | AlertSettings UI | `AlertSettings.tsx` | 6.2 |
| 6.6 | Toast 알림 연동 (Sonner) | `Toast.tsx` | 6.2 |

### Phase 7: 애니메이션 & 폴리싱 (M4~M6 병행)

| # | Task | Files | Dependency |
|---|------|-------|------------|
| 7.1 | Layout Animation (정렬 변경 시) | `ProductList.tsx` | 4.4 |
| 7.2 | AnimatedNumber (숫자 카운트업) | `AnimatedNumber.tsx` | 4.2 |
| 7.3 | Skeleton UI (로딩 상태) | `SkeletonCard.tsx` | 4.3 |
| 7.4 | Price Change Highlight (깜빡임) | CSS | 4.3 |
| 7.5 | Neon Glow (다크모드 배지) | CSS | 4.2 |
| 7.6 | CSV 내보내기 | `api/dashboard.py` | 4.1 |

### Phase 8: 배포 (M7)

| # | Task | Dependency |
|---|------|------------|
| 8.1 | Vercel 배포 설정 (환경변수) | Phase 4 완료 |
| 8.2 | Railway 배포 설정 (PostgreSQL, 환경변수) | Phase 3 완료 |
| 8.3 | CORS 설정 | 8.1, 8.2 |
| 8.4 | 모니터링 + 에러 추적 | 8.2 |

---

## 8. Environment Variables

### Frontend (.env.local)

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
```

### Backend (.env)

```env
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/asimaster
CORS_ORIGINS=["http://localhost:3000"]
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_CLAIM_EMAIL=admin@asimaster.com
CRAWL_DEFAULT_INTERVAL_MIN=60
CRAWL_MAX_RETRIES=3
CRAWL_REQUEST_DELAY_MIN=2
CRAWL_REQUEST_DELAY_MAX=5
```

---

## 9. Key Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| 가격은 INTEGER (원 단위) | `int` | 소수점 없는 원화, 계산 정확도 보장 |
| 배송비 포함가 기준 | `total_price = price + shipping_fee` | 실질 비교 가격 기준 통일 |
| 상태 계산은 서버에서 | Backend에서 status 필드 계산 | FE/BE 로직 일관성, FE 부담 감소 |
| Sparkline 데이터는 목록 API에 포함 | `sparkline: int[]` (7일) | 추가 API 호출 없이 인라인 차트 표시 |
| 비용 프리셋은 JSONB | `items: JSONB` | 유연한 구조, 프리셋별 항목 수 가변 |
| 크롤러 플랫폼별 독립 모듈 | 각 파일로 분리 | 유지보수 용이, 셀렉터 변경 시 해당 파일만 수정 |
| Async SQLAlchemy | `asyncpg` 드라이버 | FastAPI async와 일치, 크롤링 병렬처리 |

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-02-20 | Initial design document | PC |
