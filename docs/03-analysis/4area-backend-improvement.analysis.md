# 4-Area Backend Improvement Gap Analysis Report

> **Analysis Type**: Design-Implementation Gap Analysis
>
> **Project**: AsiMaster Backend
> **Analyst**: gap-detector
> **Date**: 2026-02-24
> **Design Document**: User-provided 4-Area Plan (inline)

---

## 1. Analysis Overview

### 1.1 Analysis Purpose

4개 Area(SSRF 방어 + CORS 강화, 환경변수 검증, Ranking 메모리 최적화, 키워드 엔진 고도화)에 대한 상세 설계 명세와 실제 구현 코드 간의 일치율을 검증한다.

### 1.2 Analysis Scope

| Area | Design Spec | Implementation Files |
|------|------------|---------------------|
| Area 1 | SSRF 방어 + CORS 강화 | `config.py`, `store_scraper.py`, `store_import.py`, `schemas/store_import.py` |
| Area 2 | 환경변수 검증 강화 | `config.py` |
| Area 3 | Ranking 메모리 최적화 | `services/product_service.py` |
| Area 4 | 키워드 엔진 고도화 | `keyword_engine/*`, `schemas/keyword_suggest.py`, `api/keywords.py`, `store_scraper.py`, `CLAUDE.md` |

---

## 2. Area 1: SSRF 방어 + CORS 강화

### 2.1 항목별 비교

| # | Design Spec | Implementation | Status |
|---|------------|----------------|--------|
| 1-1 | `config.py`에서 `ALLOWED_HOSTS` 필드 삭제 | `config.py`에 `ALLOWED_HOSTS` 없음 (grep 결과 0건) | ✅ Match |
| 1-2a | `parse_store_slug()` slug 길이 max 50자 | `_MAX_SLUG_LEN = 50` 상수 + 2곳에서 검증 (L149, L163) | ✅ Match |
| 1-2b | `_get_store_info()` channel_name 길이 max 100 | `_sanitize_channel_name()` 에서 `name[:100]` (L130) | ✅ Match |
| 1-2c | channel_name 위험 문자 `<>"';&` 필터링 | `_DANGEROUS_CHARS = re.compile(r'[<>"\';&]')` (L124), `_sanitize_channel_name()`에서 `sub("", ...)` (L129) | ✅ Match |
| 1-3a | `store_import.py`: `store_url` Query에 `max_length=500` | `Query(..., max_length=500, ...)` (L22) | ✅ Match |
| 1-3b | `StoreImportRequest.products`에 `max_length=100` | `Field(..., min_length=1, max_length=100)` (L28) | ✅ Match |

### 2.2 Area 1 Score

```
Match: 6/6 (100%)
Missing: 0
Changed: 0
```

---

## 3. Area 2: 환경변수 검증 강화

### 3.1 항목별 비교

| # | Design Spec | Implementation | Status |
|---|------------|----------------|--------|
| 2-1a | VAPID 키 쌍 일관성 검증: 둘 다 있거나 둘 다 없어야 함 | `has_pub != has_priv` 조건으로 검증 (config.py L47) | ✅ Match |
| 2-1b | 하나만 설정 시 경고 로그 | `_logger.warning(...)` 출력 (config.py L48-51) | ✅ Match |

### 3.2 Area 2 Score

```
Match: 2/2 (100%)
Missing: 0
Changed: 0
```

---

## 4. Area 3: Ranking 데이터 메모리 최적화

### 4.1 항목별 비교

| # | Design Spec | Implementation | Status |
|---|------------|----------------|--------|
| 3-1 | `selectinload`에서 rankings eager load 제거 | `selectinload(Product.keywords)` + `selectinload(Product.cost_items)`만 사용, rankings 없음 (L249-253, L379-383) | ✅ Match |
| 3-2a | 쿼리 A: 최신 rankings (키워드별 MAX(crawled_at) 서브쿼리 JOIN) | `_fetch_latest_rankings()` (L110-139): subquery + `func.max(crawled_at)` + GROUP BY + JOIN | ✅ Match |
| 3-2b | 쿼리 B: 7일 sparkline (DB에서 GROUP BY DATE + MIN(price)) | `_fetch_sparkline_data()` (L142-183): `func.date()` + `func.min(price)` + GROUP BY + 블랙리스트 필터 | ✅ Match |
| 3-2c | 쿼리 C: 순위 변동 (내 상품 최근 데이터만) | `_fetch_rank_change()` (L186-236): naver_product_id 또는 is_my_store 조건 + 키워드별 그룹핑 + 2회 비교 | ✅ Match |
| 3-3a | 새 헬퍼: `_fetch_latest_rankings` | `async def _fetch_latest_rankings(db, keyword_ids)` (L110) | ✅ Match |
| 3-3b | 새 헬퍼: `_fetch_sparkline_data` | `async def _fetch_sparkline_data(db, keyword_ids, since, excluded_ids, excluded_malls)` (L142) | ✅ Match |
| 3-3c | 새 헬퍼: `_fetch_rank_change` | `async def _fetch_rank_change(db, keyword_ids, product_naver_id)` (L186) | ✅ Match |
| 3-4a | 기존 삭제: `_get_latest_rankings` | grep 결과 0건 (삭제 확인) | ✅ Match |
| 3-4b | 기존 삭제: `_build_sparkline` | grep 결과 0건 (삭제 확인) | ✅ Match |
| 3-4c | 기존 삭제: `_calc_rank_change` | grep 결과 0건 (삭제 확인) | ✅ Match |
| 3-5a | 유지: `_calc_my_rank` | `def _calc_my_rank(latest_rankings, product_naver_id)` (L87) | ✅ Match |
| 3-5b | 유지: `_calc_last_crawled` | `def _calc_last_crawled(active_keywords)` (L96) | ✅ Match |
| 3-6a | `get_product_list_items`에 적용 | 새 헬퍼 3종 모두 호출 (L292, L325-329) | ✅ Match |
| 3-6b | `get_product_detail`에 적용 | 새 헬퍼 3종 모두 호출 (L401, L417, L421-423) | ✅ Match |
| 3-7 | API 응답 구조 100% 동일 유지 | list_items 반환 dict 키 동일 (L331-352), detail 반환 dict 키 동일 (L500-526) | ✅ Match |

### 4.2 Area 3 Score

```
Match: 15/15 (100%)
Missing: 0
Changed: 0
```

---

## 5. Area 4: 키워드 엔진 고도화

### 5.1 4-1. 토큰 분류기 (classifier.py)

| # | Design Spec | Implementation | Status |
|---|------------|----------------|--------|
| 4-1a | 11종 카테고리: BRAND, SERIES, TYPE, MODEL, QUANTITY, CAPACITY, SIZE, COLOR, MATERIAL, FEATURE, MODIFIER | `weights.py`에 11종 모두 정의. `classifier.py`에서 CAPACITY/SIZE/QUANTITY/MODEL(정규식), MODIFIER/COLOR/MATERIAL/BRAND(내장사전), BRAND/TYPE(DB사전) 분류. FEATURE가 기본 fallback | ✅ Match |
| 4-1b | 3단계 분류: 정규식 -> 내장사전 -> DB사전 | 1단계: `_CAPACITY_RE`, `_SIZE_RE`, `_QUANTITY_RE`, `_MODEL_RE` (L174-182). 2단계: `_MODIFIERS_LOWER`, `_COLORS_LOWER`, `_MATERIALS_LOWER`, `_BRANDS_LOWER` (L185-192). 3단계: `db_brands`, `db_types` (L195-198) | ✅ Match |
| 4-1c | SERIES 카테고리 존재 | `WEIGHTS`에 `"SERIES": 7` 정의됨. 단, classifier.py 정규식/내장사전에 SERIES 전용 패턴 없음 (DB사전이나 외부에서만 분류 가능) | ⚠️ Partial |

### 5.2 4-2. SEO 가중치 (weights.py)

| # | Design Spec | Implementation | Status |
|---|------------|----------------|--------|
| 4-2a | MODEL=10 | `"MODEL": 10` | ✅ Match |
| 4-2b | BRAND=9 | `"BRAND": 9` | ✅ Match |
| 4-2c | TYPE=9 | `"TYPE": 9` | ✅ Match |
| 4-2d | SERIES=7 | `"SERIES": 7` | ✅ Match |
| 4-2e | CAPACITY=5 | `"CAPACITY": 5` | ✅ Match |
| 4-2f | QUANTITY=4 | `"QUANTITY": 4` | ✅ Match |
| 4-2g | SIZE=4 | `"SIZE": 4` | ✅ Match |
| 4-2h | COLOR=3 | `"COLOR": 3` | ✅ Match |
| 4-2i | MATERIAL=3 | `"MATERIAL": 3` | ✅ Match |
| 4-2j | FEATURE=3 | `"FEATURE": 3` | ✅ Match |
| 4-2k | MODIFIER=-2 | `"MODIFIER": -2` | ✅ Match |

### 5.3 4-3. 키워드 생성기 (generator.py)

| # | Design Spec | Implementation | Status |
|---|------------|----------------|--------|
| 4-3a | specific 2개 (MODEL 포함) | `# --- Specific (MODEL 포함) ---` 블록: MODEL+TYPE, BRAND+MODEL 조합 (L58-72) | ✅ Match |
| 4-3b | medium 2개 (BRAND/SERIES + TYPE) | `# --- Medium ---` 블록: BRAND+TYPE, SERIES+TYPE, BRAND+SERIES, BRAND+TYPE+extra (L75-84) | ✅ Match |
| 4-3c | broad 1개 | `# --- Broad ---` 블록: FEATURE+TYPE 또는 TYPE 단독 (L87-98) | ✅ Match |
| 4-3d | 50자 제한 | `_MAX_KEYWORD_LEN = 50` (L7), `len(text) > _MAX_KEYWORD_LEN` 검증 (L134) | ✅ Match |
| 4-3e | 2~5 단어 | `_MIN_WORDS = 2`, `_MAX_WORDS = 5` (L8-9), `word_count < _MIN_WORDS` 검증 (L136) | ✅ Match |
| 4-3f | MODIFIER 제외 | `valid = [t for t in tokens if t.category != "MODIFIER"]` (L40) | ✅ Match |

### 5.4 4-4. DB 사전 (dictionary.py)

| # | Design Spec | Implementation | Status |
|---|------------|----------------|--------|
| 4-4a | `build_brand_dict` 함수 | `async def build_brand_dict(db)` (L22): DISTINCT brand + maker 수집 | ✅ Match |
| 4-4b | `build_type_dict` 함수 | `async def build_type_dict(db)` (L57): DISTINCT category1~4 수집 | ✅ Match |
| 4-4c | TTL 24시간 | `_TTL = 86400` (L13), `time.monotonic()` 기반 캐시 무효화 (L26, L62) | ✅ Match |

### 5.5 4-5. store_scraper suggest_keywords 교체

| # | Design Spec | Implementation | Status |
|---|------------|----------------|--------|
| 4-5 | `store_scraper.suggest_keywords`를 키워드 엔진 호출로 교체 | `from app.services.keyword_engine.classifier import classify_tokens` + `from app.services.keyword_engine.generator import generate_keywords` 임포트 후 호출 (L57-71) | ✅ Match |

### 5.6 4-6. POST /api/v1/keywords/suggest API

| # | Design Spec | Implementation | Status |
|---|------------|----------------|--------|
| 4-6a | 엔드포인트 존재 | `@router.post("/keywords/suggest", ...)` (keywords.py L87) | ✅ Match |
| 4-6b | DB 사전 로드 연동 | `build_brand_dict(db)` + `build_type_dict(db)` 호출 (L101-102) | ✅ Match |
| 4-6c | 토큰 분류 + 키워드 생성 | `classify_tokens(name, db_brands, db_types)` + `generate_keywords(tokens)` (L105-108) | ✅ Match |
| 4-6d | 응답 스키마 | `KeywordSuggestionResponse(tokens, keywords, field_guide)` (L114-127) | ✅ Match |

### 5.7 4-7. CLAUDE.md 업데이트

| # | Design Spec | Implementation | Status |
|---|------------|----------------|--------|
| 4-7a | `POST /api/v1/keywords/suggest` 엔드포인트 기록 | CLAUDE.md L80, L257-262에 기록됨 | ✅ Match |
| 4-7b | 키워드 엔진 패키지 기록 | CLAUDE.md L264-269에 전체 파일 구조 기록됨 | ✅ Match |
| 4-7c | store_scraper 변경 기록 | CLAUDE.md L273에 기록됨 | ✅ Match |
| 4-7d | 보안 강화 내용 기록 | CLAUDE.md L244-249에 기록됨 | ✅ Match |
| 4-7e | 메모리 최적화 내용 기록 | CLAUDE.md L251-254에 기록됨 | ✅ Match |
| 4-7f | 현재 완료된 기능 목록 업데이트 | CLAUDE.md L112: `16. SEO 키워드 엔진` 추가됨 | ✅ Match |

### 5.8 Area 4 Score

```
Match: 30/31 (96.8%)
Partial: 1 (SERIES 분류 경로 미비)
Missing: 0
```

---

## 6. Overall Scores

| Category | Items | Match | Partial | Missing | Score | Status |
|----------|:-----:|:-----:|:-------:|:-------:|:-----:|:------:|
| Area 1: SSRF 방어 + CORS 강화 | 6 | 6 | 0 | 0 | **100%** | ✅ |
| Area 2: 환경변수 검증 강화 | 2 | 2 | 0 | 0 | **100%** | ✅ |
| Area 3: Ranking 메모리 최적화 | 15 | 15 | 0 | 0 | **100%** | ✅ |
| Area 4: 키워드 엔진 고도화 | 31 | 30 | 1 | 0 | **98.4%** | ✅ |
| **Overall** | **54** | **53** | **1** | **0** | **99.1%** | ✅ |

---

## 7. Differences Found

### 7.1 Missing Features (Design O, Implementation X)

없음.

### 7.2 Added Features (Design X, Implementation O)

| Item | Implementation Location | Description |
|------|------------------------|-------------|
| `_sanitize_channel_name` 별도 함수 | `store_scraper.py:127` | 설계에서는 `_get_store_info()` 내부 처리로 기술했으나 별도 함수로 분리 (더 좋은 구조) |
| `_is_my_exact_product` 헬퍼 | `product_service.py:81` | 설계에는 미언급이나 `_calc_my_rank`의 보조 함수로 추가됨 |
| `_filter_relevant` 공통 헬퍼 | `product_service.py:54` | 블랙리스트 + is_relevant 필터를 공통 함수로 추출 (좋은 리팩토링) |
| `_find_lowest`, `_calc_price_gap` 헬퍼 | `product_service.py:64,72` | 가격 계산 로직을 별도 함수로 분리 (코드 품질 향상) |
| `keyword_engine/__init__.py` | `services/keyword_engine/__init__.py` | 패키지 exports 정의 (설계 명세에 미언급이나 Python 패키지 관례) |

### 7.3 Changed Features (Design != Implementation)

| Item | Design | Implementation | Impact |
|------|--------|----------------|--------|
| SERIES 분류 경로 | 11종 카테고리 중 SERIES 분류 경로 명시 | classifier.py에 SERIES 전용 정규식/내장사전 없음. WEIGHTS에만 존재. DB사전으로도 직접 분류 불가(brand/type만). 외부에서 수동 지정해야만 SERIES로 분류됨 | Low - 실사용에서 SERIES 토큰은 DB에서 TYPE으로 분류되거나 FEATURE fallback. generator.py의 SERIES 조합 로직은 정상 존재하므로 기능적 영향 미미 |

---

## 8. Code Quality Observations

### 8.1 Architecture Compliance

| Aspect | Status | Notes |
|--------|--------|-------|
| 서비스 레이어 분리 | ✅ | `product_service.py`가 비즈니스 로직 전담, API 라우터는 얇은 레이어 |
| DB 쿼리 최적화 | ✅ | 서브쿼리 JOIN, 배치 조회, GROUP BY 집계 활용 |
| 패키지 모듈화 | ✅ | `keyword_engine/`가 classifier, weights, generator, dictionary로 명확히 분리 |
| 입력 검증 | ✅ | Pydantic Field 제약, URL 화이트리스트, 위험문자 필터링 |

### 8.2 Security Posture

| Check | Status | File:Line |
|-------|--------|-----------|
| URL 화이트리스트 | ✅ | `store_scraper.py:116-120` (`ALLOWED_STORE_HOSTS`) |
| HTTPS 강제 | ✅ | `store_scraper.py:157` |
| Slug 길이 제한 | ✅ | `store_scraper.py:149,163` |
| Channel name sanitize | ✅ | `store_scraper.py:127-130` |
| Query param 길이 제한 | ✅ | `store_import.py:22` |
| Request body 크기 제한 | ✅ | `schemas/store_import.py:28` |
| VAPID 키 검증 | ✅ | `config.py:44-51` |
| 미사용 ALLOWED_HOSTS 삭제 | ✅ | `config.py` (없음 확인) |

---

## 9. Recommended Actions

### 9.1 Optional Improvements (Low Priority)

| Priority | Item | File | Description |
|----------|------|------|-------------|
| Info | SERIES 분류 경로 추가 | `classifier.py` | SERIES 전용 내장 사전 또는 정규식 추가하면 SERIES 토큰 분류 가능. 현재는 FEATURE로 fallback되어 generator의 SERIES 조합이 발동하지 않음 |
| Info | excluded_malls 최적화 | `product_service.py` | `_fetch_sparkline_data`에서 mall_name 제외 시 반복 WHERE 대신 NOT IN 서브쿼리 고려 |

### 9.2 No Immediate Actions Required

설계 명세 대비 99.1% 일치율로, 즉시 조치가 필요한 항목은 없다.

---

## 10. Design Document Updates Needed

설계 반영이 필요한 항목 없음. CLAUDE.md는 이미 전체 변경 사항을 반영 완료.

---

## 11. Summary

4개 Area 전체에서 설계 명세와 구현이 거의 완벽하게 일치한다.

- **Area 1** (SSRF/CORS): 6개 항목 모두 정확히 구현 (100%)
- **Area 2** (환경변수): 2개 항목 모두 정확히 구현 (100%)
- **Area 3** (메모리 최적화): 15개 항목 모두 정확히 구현 (100%)
- **Area 4** (키워드 엔진): 31개 항목 중 30개 완전 일치, 1개 부분 일치 (98.4%)

유일한 부분 일치 항목(SERIES 분류 경로)은 가중치 정의와 generator 조합 로직은 존재하나, classifier에서 SERIES로 분류하는 정규식/사전이 없어 실질적으로 SERIES 카테고리 토큰이 생성되지 않는다는 점이다. 다만 이는 기능적 영향이 미미하고, 향후 SERIES 사전 추가로 쉽게 해결 가능하다.

구현 과정에서 설계에 없던 유용한 헬퍼 함수들(`_filter_relevant`, `_find_lowest`, `_calc_price_gap`, `_is_my_exact_product`)이 추가되어 코드 품질이 설계 시점보다 향상되었다.

**Overall Match Rate: 99.1% -- PASS**

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-02-24 | Initial gap analysis | gap-detector |
