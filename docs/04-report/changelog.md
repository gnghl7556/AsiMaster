# AsiMaster Changelog

> Release notes and PDCA completion records

---

## [2026-02-24] - Shipping Fee Integration

### Added
- `shipping_fee` column to `KeywordRanking` model (INTEGER DEFAULT 0)
- Smart store shipping fee extraction via page scraping
  - `_fetch_shipping_fee()` async function in naver.py
  - Extracts `__PRELOADED_STATE__` JSON from smartstore.naver.com, brand.naver.com
  - Parses `delivery.deliveryFee.baseFee` or `FREE_DELIVERY` flag
  - Graceful fallback to 0 for non-smartstore sellers (auction, 11번가, etc.)
- Semaphore(3)-controlled parallel shipping fee fetching (max 3 concurrent HTTP requests)
- Schema extensions: `shipping_fee` field in RankingItemResponse, CompetitorSummary

### Changed
- `lowest_price` calculation: **Now includes shipping fee** (price + shipping_fee)
- `sparkline` aggregation: Now based on total cost (price + shipping_fee)
- `price_gap` calculation: Based on total cost instead of product price alone
- `status` determination (winning/close/losing): Uses total cost
- Service layer: Updated `_find_lowest()`, `_fetch_sparkline_data()`, competitors dict

### Technical Details
- **Smart Store Hosts**: smartstore.naver.com, m.smartstore.naver.com, brand.naver.com
- **Mobile User-Agent**: Improves scraping success rate
- **Timeout**: 8 seconds per request (non-blocking on slow responses)
- **Error Handling**: All exceptions gracefully fallback to shipping_fee=0
- **Database Migration**: ALTER TABLE shipping_fee INTEGER DEFAULT 0 (executed on startup)

### Quality Metrics
- **Design Match Rate**: 100% (18/18 verification points)
- **Files Modified**: 9 (crawlers, models, services, schemas, main.py, CLAUDE.md)
- **Lines Added**: +89
- **DB Columns Added**: 1 (shipping_fee)
- **Iterations Required**: 0

**PDCA Status**: Complete (Plan → Design → Do → Check → Act)
**Gap Analysis Score**: 100%
**Deployment**: Backend changes pushed to Railway

---

## [2026-02-23] - Phase 6: Code Quality Improvements

### Added
- `backend/app/core/utils.py` — `utcnow()` helper for timezone-aware UTC timestamps (Python 3.12+ compatible)
- `backend/app/services/excluded_service.py` — Service layer for blacklist business logic
  - `get_excluded_list()` — Retrieve excluded product IDs
  - `add_excluded()` — Add product to blacklist + update rankings
  - `remove_excluded()` — Remove from blacklist + update rankings

### Changed
- Replaced all 5 `datetime.utcnow()` deprecated calls with `utcnow()` helper
  - Files: `manager.py`, `product_service.py`, `jobs.py`, `crawl.py`, `prices.py`
- Extracted 4 helper functions from `product_service.py` to eliminate code duplication
  - `_filter_relevant()` — Filters rankings by relevance + blacklist
  - `_find_lowest()` — Calculates lowest price with safety checks
  - `_build_sparkline()` — Constructs 30-day sparkline data
  - `_calc_price_gap()` — Calculates price gap with ZeroDivision guard
- Refactored blacklist API endpoints to use service layer
  - Reduced endpoint code from ~110 to ~15 lines (86% reduction)
- API endpoints now delegate business logic to service layer

### Fixed
- Python 3.12 deprecation warning: `datetime.utcnow()` → proper timezone-aware UTC
- ZeroDivision error in price gap calculation (lowest_price = 0 scenario)
- SQL injection vulnerability in product search: LIKE wildcard escaping (`%`, `_`, `\`)
- Code duplication in product listing and detail endpoints

### Quality Metrics
- **Design Match Rate**: 100% (5/5 plan items, 8/8 files)
- **Technical Debt**: Eliminated 5 deprecated API calls, 4 duplicate code blocks
- **Code Reduction**: 86% line reduction in blacklist endpoints
- **Security**: OWASP A03:2021 SQL injection prevention, ZeroDivision robustness

**PDCA Status**: Complete (Plan → Design → Do → Check → Act)
**Gap Analysis Score**: 100%
**Deployment**: Backend changes pushed to Railway

---

## [2026-02-22] - Naver API 전체 필드 저장 + 카테고리 트리 API

### Added
- Extended `KeywordRanking` model with 8 new Naver API fields:
  - `hprice` (최고가, INTEGER DEFAULT 0)
  - `brand` (브랜드명, VARCHAR(200))
  - `maker` (제조사명, VARCHAR(200))
  - `product_type` (상품 구분, VARCHAR(10)) — 1=일반, 2=중고, 3=리퍼 등
  - `category1` ~ `category4` (네이버 카테고리 4단계, VARCHAR(100))
- `GET /api/v1/naver-categories` — 크롤링 데이터 기반 카테고리 트리
  - Response: Nested category hierarchy with product counts per level
  - Aggregates by (category1, category2, category3, category4) GROUP BY
  - Sorted by product_count descending
  - Includes total_paths count
- Extended `RankingItemResponse` schema with 8 fields
- Extended `CompetitorSummary` with hprice, brand, maker
- Added `sort_type` field to `KeywordWithRankings` (was missing)
- Store import: `StoreProductItem` and preview response now include brand/maker

### Implementation
- Modified 12 backend files, created 1 new file (categories.py)
- Added 8 ALTER TABLE statements for database migration
- Naver API extraction with defensive coding pattern: `int(item.get("hprice", 0) or 0)`
- Category tree building with O(n) single-pass algorithm
- Service layer serialization updated for competitors and keywords endpoints

### Type Consistency
- Dataclass: `str = ""` (non-nullable with empty default)
- DB Model: `str | None` (nullable for backward compatibility)
- Schema: `str | None = None` (reflects database reality)

**PDCA Status**: Complete (Plan → Design → Do → Check → Act)
**Gap Analysis Score**: 100% (88/88 verification points)
**Iterations**: 0 (first implementation achieved full compliance)
**Deployment**: Railway backend live, categories.py endpoint tested

---

## [2026-02-21] - Bulk Delete & User Lifecycle Management

### Added
- `POST /api/v1/users/{user_id}/products/bulk-delete` — Delete multiple products in one request
  - Request: `BulkDeleteRequest { product_ids: list[int] }` (min_length=1)
  - Response: `BulkDeleteResult { deleted: int }`
  - Security: user_id filtering prevents cross-user deletion
  - Edge cases: Non-existent IDs silently ignored, cascade handles all child records

### Fixed
- Bug fix in `PUT /api/v1/users/{user_id}` — `crawl_interval_min` field now correctly applied in update handler
  - Previously: Field accepted but not persisted to database
  - Now: Applied using same pattern as other user fields (`if data.crawl_interval_min is not None:`)

### Changed
- Updated CLAUDE.md API endpoints list with bulk-delete operation

### Verified
- **Security**: User ownership validation via `Product.user_id == user_id` filter; prevents cross-user deletion
- **Cascade Delete**: Verified complete cascade chain for product deletion:
  - Product → SearchKeyword → KeywordRanking (cascade delete)
  - Product → CostItem (cascade delete)
  - Product → ExcludedProduct (cascade delete)
  - Product → Alert (ondelete: SET NULL)
  - Product → CrawlLog via SearchKeyword (ondelete: SET NULL)
- **Edge Cases**:
  - Empty list rejected with 422 Validation Error
  - Non-existent IDs silently ignored
  - Duplicate IDs deduplicated
  - Cross-user product IDs ignored

**PDCA Status**: Complete (Plan → Design → Do → Check → Act)
**Gap Analysis Score**: 95% → 100%
**Deployment**: Railway backend live

---

## [2026-02-21] - Keyword Sort Type & Smart Store Import

### Added
- Keyword-level sort type selection: `sort_type` field in `SearchKeyword` model
  - `"sim"` — Relevance ranking (Naver Shopping default)
  - `"asc"` — Price ranking (low to high)
- `POST /api/v1/keywords/{product_id}` accepts `sort_type` parameter
- `GET /api/v1/products/{product_id}` returns keywords with `sort_type` field
- Crawling respects per-keyword sort type via Naver API `sort` parameter

### Added
- Smart Store product auto-import feature
  - `GET /api/v1/users/{user_id}/store/products?store_url=<URL>` — Preview products from store
    - Response: List of products with name, price, image_url, category
    - Implementation: Smart Store page scraping → channel extraction → Naver Shopping API search
  - `POST /api/v1/users/{user_id}/store/import` — Bulk import selected products
    - Request: List of products to import
    - Response: Count of created, skipped (duplicates), and error reasons
    - Auto-generate default keyword (product name) for each imported product
    - Deduplication: Skip products with same name as existing products

### Implementation Files
- `backend/app/crawlers/store_scraper.py` — Smart Store scraping + Naver API integration
- `backend/app/schemas/store_import.py` — StoreProductItem, StoreImportRequest, StoreImportResult
- `backend/app/api/store_import.py` — REST endpoints for preview and import

---

## [2026-02-21] - Crawl Performance Optimization

### Added
- Connection pooling: httpx AsyncClient with persistent connection pool (5-10 concurrent connections)
- Parallel crawling: Asyncio Semaphore to limit concurrent requests (2-3 per user)
- Crawl delay: Random delay between keyword requests (1-3 seconds) to prevent rate limiting
- User-level crawling: Bulk crawl all products + keywords with deduplication by (keyword, sort_type)
- Crawl metrics: `avg_duration_ms` field in crawl status API responses

### Changed
- Crawl logging: Enhanced `CrawlLog` to track keyword_id (added via migration)
- Naver API timeout: Increased to 15 seconds for reliability

---

## [2026-02-21] - Product Ranking & Relevance Filtering

### Added
- Product relevance filtering: `is_relevant` flag in `KeywordRanking` model
  - Auto-calculated based on `Product.model_code` + `Product.spec_keywords` matching
  - Prevents unrelated products from appearing in competition list
- Product model metadata: `model_code` and `spec_keywords` fields in Product model
- Blacklist/exclusion feature: Manually exclude competitor products from ranking calculations
  - `GET /api/v1/products/{id}/excluded` — View blacklist
  - `POST /api/v1/products/{id}/excluded` — Add to blacklist
  - `DELETE /api/v1/products/{id}/excluded/{naver_product_id}` — Remove from blacklist
  - Impact: Excluded products don't affect lowest price, sparkline, or rank changes

### Changed
- Competition summary: Only shows relevant products (`is_relevant=true`)
- Price calculations: Lowest price calculated from relevant products only
- Sparkline: Charts only include relevant products
- Ranking changes: Compared only against relevant competitors

---

## [2026-02-21] - Product List & Details Enhancements

### Added
- Product list pagination: `page` and `limit` query parameters
- Product list sorting: By name, price, rank change, created date
- `rank_change` field: Shows ranking movement since last crawl
- Product details enhancements:
  - `user_id` field (for auth verification)
  - `rank_change` field (ranking movement)
  - `keyword_count` field (number of tracked keywords)
  - `sparkline` field (price trend visualization)
  - `competitors` field (array of top competitors)

---

## [2026-02-21] - Web Push Notifications

### Added
- Web Push infrastructure (VAPID key pair)
  - `GET /api/v1/push/vapid-public-key` — Client-side subscription setup
  - `POST /api/v1/push/subscribe` — Register service worker subscription
  - `DELETE /api/v1/push/subscribe` — Unregister subscription
- Automatic push notifications on alert trigger:
  - Price drop alerts
  - Ranking drop alerts
  - Low stock alerts
- `push_subscriptions` database table with FK cascade to User

---

## Previous Releases

### [2026-02-21] - Core Features (R3)
- User/Product/Keyword management
- Naver Shopping API crawling
- Alert system with email/push
- Dashboard with metrics
- Cost preset management
- Excluded product blacklisting

---

## Version Numbering

- **Major**: Breaking API changes or significant feature additions
- **Minor**: Non-breaking features
- **Patch**: Bug fixes and documentation updates

Current version: **AsiMaster v1.0.0** (in development)
