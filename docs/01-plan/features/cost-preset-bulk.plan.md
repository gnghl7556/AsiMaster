# Plan: 비용 프리셋 복수 적용

## 개요
현재 비용 프리셋은 생성/삭제만 가능하고 수정 API가 없으며, 1개 상품에만 적용할 수 있다.
프리셋 수정(PUT) API를 추가하고, 복수 상품에 프리셋을 일괄 적용하는 기능을 구현하여
비용 관리의 효율성을 크게 높인다.

## 현재 상태 (As-Is)
- **프리셋 CRUD**: 생성(POST), 조회(GET), 삭제(DELETE)만 존재 — **수정(PUT) 없음**
- **프론트엔드 우회**: 수정 시 새로 생성 후 기존 삭제하는 방식 (`CostPresetForm.tsx`)
- **적용 방식**: 프론트에서 프리셋 items를 읽어 `PUT /products/{id}/costs`에 1건씩 전달
- **1:N 적용 불가**: 복수 상품에 동시 적용하는 API/UI 없음
- **모델**: `CostPreset`은 items를 JSON blob으로 저장 (프리셋 ↔ 상품 간 연결 없음)

## 목표 상태 (To-Be)
1. **프리셋 수정 API**: `PUT /cost-presets/{preset_id}` — 이름, items 수정 가능
2. **복수 적용 API**: `POST /cost-presets/{preset_id}/apply` — 여러 상품에 일괄 적용
3. **양방향 적용 UI 지원**:
   - 상품 목록 → 체크 → 프리셋 선택 → 적용
   - 프리셋 상세 → 적용할 상품 선택 → 적용
4. **적용된 프리셋 추적**: 상품이 어떤 프리셋을 기반으로 하는지 알 수 있음

## 변경 범위

### 1. DB 모델 변경
#### `CostPreset` 모델 수정 (`models/cost.py`)
- `updated_at` 필드 추가 (DateTime, server_default, onupdate)

#### `Product` 모델 수정 (`models/product.py`)
- `cost_preset_id` 필드 추가 (Integer, FK to cost_presets.id, nullable)
- 어떤 프리셋이 적용되었는지 추적 (참조용, 프리셋 삭제 시 SET NULL)

### 2. Pydantic 스키마 변경 (`schemas/cost.py`)
- `CostPresetUpdate`: 새 스키마 추가 (name: Optional, items: Optional)
- `CostPresetApplyRequest`: `{ product_ids: list[int] }` (최소 1개, 최대 100개)
- `CostPresetApplyResponse`: `{ applied: int, failed: int, details: [...] }`
- `CostPresetResponse`: `updated_at` 필드 추가
- `ProductResponse`/`ProductDetail`/`ProductListItem`: `cost_preset_id` 필드 추가

### 3. API 변경 (`api/costs.py`)

#### 새 엔드포인트
- `PUT /cost-presets/{preset_id}` → 프리셋 수정
  - Request: `CostPresetUpdate { name?: str, items?: list[CostItemInput] }`
  - Response: `CostPresetResponse`
  - 부분 수정 지원 (name만 또는 items만 변경 가능)

- `POST /cost-presets/{preset_id}/apply` → 복수 상품에 프리셋 적용
  - Request: `CostPresetApplyRequest { product_ids: [1, 2, 3] }`
  - Response: `CostPresetApplyResponse { applied: 3, failed: 0 }`
  - 동작: 각 상품의 cost_items를 프리셋 items로 **전체 교체** + cost_preset_id 갱신
  - 트랜잭션: 전체 성공 or 전체 롤백 (일부 실패 시 어떤 상품에서 실패했는지 응답)

#### 기존 엔드포인트 수정
- `PUT /products/{product_id}/costs`: cost_preset_id를 null로 리셋 (수동 수정 시 프리셋 연결 해제)
- `DELETE /cost-presets/{preset_id}`: 해당 프리셋을 참조하는 상품들의 cost_preset_id를 null로 처리 (FK SET NULL)

### 4. 프론트엔드 (Codex 담당)
#### 상품 목록 → 프리셋 적용
- 상품 목록에서 체크박스로 복수 선택
- "비용 프리셋 적용" 버튼 → 프리셋 선택 모달 → `POST /cost-presets/{id}/apply`

#### 프리셋 관리 → 상품 적용
- 프리셋 상세에서 "상품에 적용" 버튼 → 상품 선택 모달 → 동일 API 호출

#### 프리셋 수정
- 기존 삭제+재생성 방식 → `PUT /cost-presets/{id}` 직접 호출로 변경

## 적용 로직 상세

```
POST /cost-presets/{preset_id}/apply
  ↓
1. 프리셋 조회 (preset.items 로드)
2. product_ids 유효성 검증 (존재 여부, user_id 소속 확인)
3. 각 상품에 대해:
   a. 기존 cost_items 전부 DELETE
   b. 프리셋 items로 새 CostItem 행 INSERT
   c. product.cost_preset_id = preset_id 갱신
4. 전체 커밋
5. 결과 반환 { applied: N }
```

## 기존 데이터 호환성
- `cost_preset_id` nullable → 기존 상품 영향 없음 (null = 수동 설정)
- 기존 cost_items 데이터 유지 (프리셋 적용 시에만 교체)
- 프리셋 삭제 시 FK SET NULL → 상품의 cost_items는 유지, 참조만 해제
- `CostPreset.updated_at` 추가 → 기존 프리셋에 null (무해)

## 구현 순서
1. `CostPreset` 모델에 `updated_at` 추가
2. `Product` 모델에 `cost_preset_id` FK 추가
3. `main.py` ALTER TABLE 마이그레이션
4. `CostPresetUpdate`, `CostPresetApplyRequest/Response` 스키마 추가
5. `PUT /cost-presets/{preset_id}` 엔드포인트 구현
6. `POST /cost-presets/{preset_id}/apply` 엔드포인트 구현
7. `PUT /products/{product_id}/costs` 수정 (cost_preset_id 리셋)
8. `DELETE /cost-presets/{preset_id}` 수정 (SET NULL 처리)
9. Product 스키마에 cost_preset_id 필드 추가
10. CLAUDE.md API 명세 업데이트

## 수정 파일 목록 (백엔드 6개)
| 파일 | 변경 내용 |
|------|----------|
| `models/cost.py` | CostPreset에 updated_at 추가 |
| `models/product.py` | cost_preset_id FK 추가 |
| `schemas/cost.py` | CostPresetUpdate, ApplyRequest/Response 추가 |
| `schemas/product.py` | cost_preset_id 필드 추가 |
| `api/costs.py` | PUT preset, POST apply, DELETE 수정 |
| `main.py` | ALTER TABLE 마이그레이션 |
| `CLAUDE.md` | API 명세 업데이트 |

## 리스크
- **대량 적용 성능**: 100개 상품 적용 시 DELETE + INSERT가 최대 200개 → 단일 트랜잭션으로 처리
- **프리셋 수정 후 동기화**: 프리셋 수정해도 이미 적용된 상품의 cost_items는 자동 변경되지 않음 (의도적, 재적용 필요)
- **동시 수정 충돌**: 같은 상품에 동시 프리셋 적용 시 마지막 건이 승리 (acceptable for 개인용 도구)
