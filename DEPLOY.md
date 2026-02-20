# asimaster 배포 가이드

## 아키텍처

```
[Vercel] ← Frontend (Next.js)
    ↓ NEXT_PUBLIC_API_URL
[Railway] ← Backend (FastAPI + Playwright)
    ↓ DATABASE_URL
[Railway PostgreSQL] ← Database
```

## 1. Git 저장소 설정

```bash
cd C:\Users\PC\Documents\asimaster
git init
git add .
git commit -m "Initial commit"
```

GitHub에 새 리포지토리 생성 후:
```bash
git remote add origin https://github.com/<username>/asimaster.git
git branch -M main
git push -u origin main
```

## 2. Railway 배포 (Backend + DB)

### 2-1. PostgreSQL 추가
1. [Railway](https://railway.app) 접속 → New Project
2. **Add Service** → **Database** → **PostgreSQL** 선택
3. PostgreSQL 서비스 클릭 → **Variables** 탭 → `DATABASE_URL` 복사

### 2-2. Backend 서비스 추가
1. **Add Service** → **GitHub Repo** → asimaster 리포지토리 선택
2. **Settings** 탭:
   - **Root Directory**: `backend`
   - **Builder**: Dockerfile
3. **Variables** 탭에서 환경변수 설정:

| 변수 | 값 | 비고 |
|------|-----|------|
| `DATABASE_URL` | PostgreSQL의 `DATABASE_URL` | Railway 내부 연결 사용 |
| `CORS_ORIGINS` | `["https://asimaster.vercel.app"]` | Vercel 도메인으로 변경 |
| `VAPID_PUBLIC_KEY` | (생성한 키) | 선택사항 |
| `VAPID_PRIVATE_KEY` | (생성한 키) | 선택사항 |
| `PORT` | Railway가 자동 주입 | 설정 불필요 |

4. **Deploy** → 빌드 로그 확인
5. 배포 완료 후 **Settings** → **Networking** → **Public Networking** 활성화
6. 생성된 도메인 확인 (예: `asimaster-backend-production.up.railway.app`)

### 2-3. 헬스체크 확인
```bash
curl https://<railway-domain>/health
# {"status":"ok"}
```

## 3. Vercel 배포 (Frontend)

1. [Vercel](https://vercel.com) 접속 → **Add New Project**
2. GitHub 리포지토리 선택
3. **Framework Preset**: Next.js
4. **Root Directory**: `frontend`
5. **Environment Variables**:

| 변수 | 값 |
|------|-----|
| `NEXT_PUBLIC_API_URL` | `https://<railway-domain>/api/v1` |

6. **Deploy** 클릭

## 4. 배포 후 확인사항

- [ ] Railway 헬스체크 통과 (`/health`)
- [ ] Vercel 빌드 성공
- [ ] 프론트엔드에서 API 호출 정상 동작
- [ ] CORS 에러 없음 (Railway `CORS_ORIGINS`에 Vercel 도메인 포함 확인)
- [ ] 크롤링 스케줄러 정상 동작

## 5. VAPID 키 생성 (푸시 알림용, 선택사항)

```bash
npx web-push generate-vapid-keys
```

출력된 Public/Private 키를 Railway 환경변수에 설정합니다.

## 현재 배포 정보

| 서비스 | URL |
|--------|-----|
| Frontend | https://shop-asimaster.vercel.app |
| Backend API | https://asimaster-production.up.railway.app/api/v1 |
| GitHub | https://github.com/gnghl7556/AsiMaster |

## 주의사항

- Railway 무료 플랜: 월 $5 크레딧, Playwright + Chromium이 포함된 이미지는 메모리 사용량이 높음
- Railway PostgreSQL: 무료 플랜 500MB 제한
- Vercel 무료 플랜: 상업용 사용 시 Pro 플랜 필요
- `DATABASE_URL`은 Railway 내부 네트워크 URL 사용 권장 (`railway.internal` 접미사)
- 코드 수정 후 `git push`만 하면 Railway/Vercel 자동 재배포
