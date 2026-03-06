# UX 버그/기능 수정 Plan

> **Feature**: ux-bugfix
> **Date**: 2026-03-06
> **Phase**: Plan

---

## 1. 배경

알림 시스템 개선(텔레그램, VAPID) 이후 모바일 테스트에서 발견된 UX 버그 3건을 수정한다.
알림 설정 화면이 비어있거나, 라벨이 누락되거나, 읽은 알림을 다시 확인할 수 없는 문제.

---

## 2. 작업 항목

### Item 1: 신규 유저 기본 AlertSetting 자동 생성

**현재 상태**: 유저 생성 시 `alert_settings` 테이블에 행이 없음 → 알림 설정 페이지가 빈 화면
**원인**: `create_user()` 에서 AlertSetting 레코드를 생성하지 않음
**수정**: 유저 생성 후 기본 AlertSetting 2개 자동 INSERT

| alert_type | is_enabled | threshold |
|------------|-----------|-----------|
| `price_undercut` | true | null |
| `rank_drop` | true | null |

**파일**: `backend/app/api/users.py` — `create_user()` 함수
**모델 참조**: `backend/app/models/alert.py` — `AlertSetting`

### Item 2: 알림 페이지 `rank_drop` 라벨 추가

**현재 상태**: `ALERT_TYPE_LABELS`에 `rank_drop` 미등록 → 알림 타입명이 그대로 표시됨
**수정**: `rank_drop` 라벨 추가

```
ALERT_TYPE_LABELS = {
  price_undercut: { label: "최저 총액 이탈", color: "text-red-500" },
  rank_drop:      { label: "순위 하락",      color: "text-amber-500" },   // 추가
  new_competitor:  { label: "신규 경쟁자",    color: "text-amber-500" },   // 기존 유지
  price_surge:     { label: "가격 급변동",    color: "text-blue-500" },    // 기존 유지
};
```

**파일**: `frontend/src/app/alerts/page.tsx`

### Item 3: 읽은 알림 이력 표시

**현재 상태**: `unreadAlerts`만 렌더링 → 읽은 알림은 완전히 사라짐
**수정**: 미읽음/전체 탭 추가. 기본 뷰는 미읽음, "전체" 탭에서 읽은 알림도 확인 가능

**변경 방안**:
- 기존 `tab` 상태(`"list" | "settings"`)를 활용
- `list` 탭 내부에 서브필터 추가: `"unread" | "all"`
- 읽은 알림은 opacity 낮추어 시각 구분

**파일**: `frontend/src/app/alerts/page.tsx`

---

## 3. 구현 순서

1. BE: `users.py` — 기본 AlertSetting 자동 생성 (+ 기존 유저 마이그레이션 불필요, 설정 페이지에서 수동 생성 가능)
2. FE: `alerts/page.tsx` — `rank_drop` 라벨 추가
3. FE: `alerts/page.tsx` — 읽은 알림 이력 표시 (서브필터)
4. 테스트: 기존 `test_users.py` 유저 생성 테스트에 AlertSetting 자동 생성 검증 추가
5. pytest 전체 통과 + `next build` 확인

---

## 4. 영향 범위

| 영역 | 변경 파일 | 영향도 |
|------|----------|--------|
| BE API | `backend/app/api/users.py` | 낮음 (생성 후 추가 INSERT) |
| FE 알림 | `frontend/src/app/alerts/page.tsx` | 중간 (UI 변경) |
| 테스트 | `backend/tests/test_users.py` | 낮음 (검증 추가) |

---

## 5. 검증 기준

- [ ] 신규 유저 생성 후 `GET /users/{id}/alert-settings` → 2개 반환
- [ ] 알림 페이지에서 `rank_drop` 타입이 "순위 하락"으로 표시
- [ ] 알림 읽음 처리 후에도 "전체" 탭에서 확인 가능
- [ ] pytest 전체 통과
- [ ] `next build` 성공
