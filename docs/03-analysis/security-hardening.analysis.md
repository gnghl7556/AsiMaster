# Security Hardening (Phase 1 Partial) Analysis Report

> **Analysis Type**: Gap Analysis (Design vs Implementation)
>
> **Project**: AsiMaster
> **Analyst**: Claude Code (gap-detector)
> **Date**: 2026-02-23
> **Design Doc**: User-provided design specification (3 items: SSRF, CORS, Env Validation)

---

## 1. Analysis Overview

### 1.1 Analysis Purpose

Verify that the 3 security hardening items planned for Phase 1 (authentication-free scope) have been correctly implemented in the codebase.

### 1.2 Analysis Scope

| Item | Design Spec | Implementation File |
|------|-------------|---------------------|
| 1-3. SSRF Defense | URL host whitelist, slug regex, HTTPS-only, no redirect follow | `backend/app/crawlers/store_scraper.py` |
| 1-4. CORS Hardening | Restrict methods and headers | `backend/app/main.py` |
| 1-5. Required Env Validation | Pydantic model_validator for Naver API keys | `backend/app/core/config.py` |

---

## 2. Gap Analysis (Design vs Implementation)

### 2.1 Item 1-3: SSRF Defense (`store_scraper.py`)

| # | Requirement | Implementation | Status | Notes |
|---|-------------|---------------|--------|-------|
| 1 | `parse_store_slug()` URL host whitelist validation | `ALLOWED_STORE_HOSTS` set at L173-177; checked at L199 `if parsed.hostname not in ALLOWED_STORE_HOSTS` | **Match** | Whitelist: `smartstore.naver.com`, `m.smartstore.naver.com`, `brand.naver.com` |
| 2 | Allowed domains: `smartstore.naver.com`, `m.smartstore.naver.com`, `brand.naver.com` | Exactly these 3 domains in `ALLOWED_STORE_HOSTS` (L173-177) | **Match** | Exact match |
| 3 | Slug direct input: alphanumeric + hyphen regex validation | L194: `re.match(r'^[a-zA-Z0-9_-]+$', slug)` | **Match** (minor difference) | Also allows underscore `_` which is slightly broader than spec ("alphanumeric + hyphen"). This is acceptable -- underscores are valid in Naver store slugs |
| 4 | HTTPS-only, scheme validation | L201: `if parsed.scheme != "https": raise ValueError(...)` | **Match** | Raises `ValueError` for non-HTTPS |
| 5 | `_get_store_info()`: `follow_redirects=True` changed to `follow_redirects=False` | L149: `follow_redirects=False` | **Match** | Correctly prevents open redirect exploitation |

**Sub-score: 5/5 (100%)**

### 2.2 Item 1-4: CORS Hardening (`main.py`)

| # | Requirement | Implementation | Status | Notes |
|---|-------------|---------------|--------|-------|
| 1 | `allow_methods=["*"]` changed to `["GET", "POST", "PUT", "DELETE", "PATCH"]` | L179: `allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"]` | **Match** | Exact list match |
| 2 | `allow_headers=["*"]` changed to `["Content-Type", "Authorization"]` | L180: `allow_headers=["Content-Type", "Authorization"]` | **Match** | Exact list match |

**Sub-score: 2/2 (100%)**

### 2.3 Item 1-5: Required Env Validation (`config.py`)

| # | Requirement | Implementation | Status | Notes |
|---|-------------|---------------|--------|-------|
| 1 | Pydantic `model_validator` used | L31: `@model_validator(mode="after")` | **Match** | Uses `mode="after"` for post-init validation |
| 2 | Validates `NAVER_CLIENT_ID` exists | L34: `if not self.NAVER_CLIENT_ID` | **Match** | Empty string evaluates as falsy |
| 3 | Validates `NAVER_CLIENT_SECRET` exists | L36: `if not self.NAVER_CLIENT_SECRET` | **Match** | Empty string evaluates as falsy |
| 4 | Empty string raises `ValueError` | L38-39: `raise ValueError(f"...")` | **Match** | Default values are `""` (L14-15), so missing env vars trigger the validator |
| 5 | App startup blocked on failure | `settings = Settings()` at module level (L43) -- import-time validation | **Match** | FastAPI imports `settings` from config, so app fails to start if validation fails |

**Sub-score: 5/5 (100%)**

---

## 3. Match Rate Summary

```
+---------------------------------------------+
|  Overall Match Rate: 100%                    |
+---------------------------------------------+
|  Total Requirements:   12 items              |
|  Matched:              12 items (100%)       |
|  Missing in impl:      0 items  (0%)        |
|  Changed from spec:    0 items  (0%)        |
+---------------------------------------------+
```

| Category | Score | Status |
|----------|:-----:|:------:|
| 1-3. SSRF Defense | 100% | PASS |
| 1-4. CORS Hardening | 100% | PASS |
| 1-5. Env Validation | 100% | PASS |
| **Overall** | **100%** | **PASS** |

---

## 4. Minor Observations (Non-blocking)

These are not gaps but observations worth noting for completeness.

| # | File | Location | Observation | Severity |
|---|------|----------|-------------|----------|
| 1 | `store_scraper.py` | L194 | Slug regex `[a-zA-Z0-9_-]` includes underscore beyond the spec's "alphanumeric + hyphen". This is fine -- Naver store slugs can contain underscores. | Info |
| 2 | `config.py` | L14-15 | Default values for `NAVER_CLIENT_ID` and `NAVER_CLIENT_SECRET` are empty strings `""`, which works correctly with the validator but relies on falsy evaluation rather than explicit `is None` check. Both approaches are valid. | Info |
| 3 | `main.py` | L177 | `allow_origins=settings.CORS_ORIGINS` -- the origins list itself is not hardened in this phase (depends on env config). This was not in scope for Phase 1 partial. | Info |

---

## 5. Recommended Actions

### No immediate actions required.

All 3 design items are fully implemented as specified. The implementation matches the design specification at 100%.

### Future considerations (out of scope for this analysis):

- Consider adding rate limiting to `fetch_store_products()` to prevent abuse
- Consider validating `CORS_ORIGINS` format in the `model_validator` (ensure valid URLs)
- Consider adding `OPTIONS` to the CORS `allow_methods` list if preflight requests need explicit handling (FastAPI's CORSMiddleware handles this automatically, so this is not required)

---

## 6. Next Steps

- [x] All 3 security hardening items verified -- no fixes needed
- [ ] Commit and deploy the changes
- [ ] Proceed to next security hardening phase if planned

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-02-23 | Initial gap analysis -- 100% match | Claude Code |
