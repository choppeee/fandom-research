# 팬덤 리서치 대시보드 — 시작 가이드

이 문서는 개발 경험이 없어도 프로젝트를 실행하고 배포할 수 있도록
터미널 명령어를 그대로 복사해서 쓸 수 있게 작성했습니다.
전체 기획은 `PLAN.md`를 참고하세요.

---

## 0. 준비물

1. **Node.js 설치** (버전 20 이상 권장)
   - https://nodejs.org 접속 → "LTS" 버전 다운로드 → 설치
   - 설치 확인: 터미널(맥은 "터미널" 앱, 윈도우는 "명령 프롬프트")에서
     ```
     node -v
     ```
     버전 번호가 나오면 성공입니다.

2. **Supabase 계정 생성**
   - https://supabase.com 접속 → 무료 회원가입 → "New Project" 생성
   - 프로젝트 생성 시 리전은 "Northeast Asia (Seoul)" 선택 권장

3. **YouTube Data API 키 발급**
   - https://console.cloud.google.com 접속
   - 새 프로젝트 생성 → "API 및 서비스" → "라이브러리" → "YouTube Data API v3" 검색 → 사용 설정
   - "사용자 인증 정보" → "API 키 만들기" → 발급된 키 복사

4. **Anthropic API 키 발급**
   - https://console.anthropic.com 접속 → 회원가입 → "API Keys" → "Create Key"

---

## 1. 프로젝트 설치

1. 이 폴더(`fandom-research`)를 원하는 위치에 저장합니다.
2. 터미널에서 이 폴더로 이동합니다.
   ```bash
   cd fandom-research
   ```
3. 필요한 패키지를 설치합니다.
   ```bash
   npm install
   ```
   (인터넷 상황에 따라 1~3분 정도 걸립니다.)

---

## 2. 환경변수 설정

1. `.env.example` 파일을 복사해서 `.env.local` 이라는 이름으로 저장합니다.
   ```bash
   cp .env.example .env.local
   ```
2. `.env.local` 파일을 열어서 아래 값을 채워 넣습니다.

   | 변수명 | 어디서 확인하나요? |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase 대시보드 → Project Settings → API Keys → Project URL |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 같은 화면 → "Publishable and secret API keys" 탭 → `sb_publishable_...` 키 |
   | `SUPABASE_SECRET_KEY` | 같은 화면 → `sb_secret_...` 키 (⚠️ 절대 외부 공유 금지) |
   | `YOUTUBE_API_KEY` | 위 0단계에서 발급받은 키 |
   | `ANTHROPIC_API_KEY` | 위 0단계에서 발급받은 키 |

   > 참고: Supabase 대시보드에 "Legacy anon, service_role API keys" 라는 탭도 보이는데, 이건 옛날 방식(2026년 말 폐지 예정)이라 사용하지 않습니다. 꼭 "Publishable and secret API keys" 탭에서 키를 복사하세요.

   > ⚠️ `.env.local` 파일은 절대 GitHub에 올리면 안 됩니다. 이미 `.gitignore`에 등록되어 있어 실수로 커밋되지 않습니다.

---

## 3. Supabase 데이터베이스 테이블 만들기

1. Supabase 대시보드 → 왼쪽 메뉴 "SQL Editor" 클릭
2. "New query" 클릭
3. `PLAN.md` 문서의 "4. 데이터베이스 스키마" 섹션에 있는 SQL 코드 전체를 복사해서 붙여넣기
4. "Run" 버튼 클릭 → 테이블이 생성됩니다 (좌측 "Table Editor"에서 확인 가능)

> 이 단계는 프로젝트 진행 중 1단계(인증)에서 다시 한 번 함께 확인합니다.

---

## 4. 로컬에서 실행해보기

```bash
npm run dev
```

터미널에 아래와 비슷한 메시지가 뜨면 성공입니다.
```
Local: http://localhost:3000
```

브라우저에서 `http://localhost:3000` 을 열면 로그인 화면(`/login`)으로 이동합니다.
회원가입 후 로그인하면 "OOO님, 환영합니다" 화면이 보여야 합니다.

---

## 5. Vercel에 배포하기 (다른 사람도 접속 가능하게)

1. https://vercel.com 접속 → GitHub 계정으로 로그인
2. 이 프로젝트를 GitHub 저장소에 먼저 올립니다.
   ```bash
   git init
   git add .
   git commit -m "0단계: 프로젝트 뼈대 구축"
   ```
   → GitHub에서 새 저장소를 만든 뒤 안내에 따라 push
3. Vercel에서 "Add New Project" → 방금 만든 저장소 선택 → Import
4. "Environment Variables" 섹션에 `.env.local`의 모든 값을 똑같이 입력
5. "Deploy" 클릭 → 몇 분 후 `https://프로젝트이름.vercel.app` 주소가 생성됩니다

---

## 폴더 구조 설명

```
fandom-research/
├── app/                  화면(페이지) 관련 코드
│   ├── layout.tsx        모든 페이지의 공통 틀 (한국어 설정 포함)
│   ├── page.tsx          홈 화면 (로그인 필요, 새 리서치 시작 폼)
│   ├── globals.css       전체 디자인 색상/스타일 설정
│   ├── login/            로그인/회원가입 화면 + 서버 액션
│   ├── jobs/              내 리서치 목록(page.tsx), 상세/대시보드([jobId]/page.tsx)
│   └── api/
│       ├── jobs/          Job 생성·조회·실행(run)·인사이트·CSV/PDF 내보내기
│       └── comments/      원문 댓글 탐색기용 필터링 API
├── components/
│   ├── NewResearchForm.tsx   키워드/기간 입력 폼
│   └── JobDashboard.tsx      진행상태 폴링 + 대시보드(차트) + 댓글 탐색기
├── lib/
│   ├── supabase/
│   │   ├── client.ts     브라우저에서 Supabase에 접속할 때 사용 (공개 가능한 키만 사용)
│   │   └── server.ts     서버에서만 사용, 민감한 키는 여기서만 다룸
│   ├── youtube.ts        YouTube Data API v3 (영상 검색/상세, 댓글 수집)
│   ├── claude.ts         Claude 댓글 배치 분석 + 종합 인사이트 생성
│   └── aggregate.ts       수집된 데이터를 대시보드용 통계로 집계
├── assets/fonts/          PDF 리포트용 한글 폰트 (Nanum Gothic, OFL 라이선스)
├── middleware.ts         모든 요청마다 Supabase 로그인 세션을 갱신
├── .env.example          필요한 환경변수 목록 (실제 값은 없음)
├── .env.local            실제 키 값 (직접 만들어야 함, 절대 공유 금지)
└── PLAN.md                전체 기획 문서
```

---

## 막히는 부분이 생기면

- `npm install` 이 안 될 때: Node.js 버전이 20 이상인지 `node -v` 로 확인
- 화면에 오류가 뜰 때: 터미널에 나오는 빨간 글씨(에러 메시지)를 복사해서 저에게 보여주시면 원인을 같이 확인합니다
- Supabase 연결이 안 될 때: `.env.local`의 URL/키가 정확히 복사되었는지, 앞뒤 공백이 없는지 확인

---

## 진행 상황 (2026-07-28 기준: 1~9단계 완료)

로그인부터 키워드 입력 → 유튜브 수집 → Claude 분석 → 대시보드 → CSV/PDF 다운로드까지
전체 플로우가 동작합니다. `http://localhost:3000` 접속 시 로그인이 안 되어 있으면
자동으로 `/login`으로 이동합니다. 로그인 후 홈 화면에서 키워드/기간을 입력하고
"분석 시작"을 누르면 진행 상태 화면(`/jobs/[jobId]`)으로 이동하고, 완료되면 같은
페이지에 대시보드가 표시됩니다.

> ⚠️ Supabase SQL Editor에서 `PLAN.md` 4번 섹션 SQL(최신 버전, `research_jobs` RLS 포함)을
> 아직 실행하지 않았다면 실행해주세요.
>
> ⚠️ Supabase 프로젝트의 기본 설정은 "이메일 인증(Confirm email)"이 켜져 있어
> 회원가입 후 받은편지함의 확인 링크를 눌러야 로그인할 수 있습니다.
> 테스트를 더 편하게 하려면 Supabase 대시보드 → Authentication → Providers → Email에서
> "Confirm email"을 꺼둘 수 있습니다(실서비스 배포 전에는 다시 켜는 것을 권장합니다).
>
> ⚠️ **Claude API 크레딧이 있어야 분석 단계가 동작합니다.** 크레딧이 없으면
> "Your credit balance is too low" 오류로 Job이 실패 상태가 되며, 대시보드에
> "재시도" 버튼이 뜹니다. console.anthropic.com → Plans & Billing에서 크레딧을
> 충전한 뒤 재시도 버튼을 누르면 이어서 진행됩니다. (유튜브 영상/댓글 수집 자체는
> 크레딧과 무관하게 정상 동작하는 것을 실제로 확인했습니다.)
>
> ℹ️ PDF 리포트에는 한글 표시를 위해 오픈소스 폰트(Nanum Gothic, SIL OFL 라이선스)를
> `assets/fonts/`에 포함해뒀습니다. 별도 설치나 시스템 폰트가 필요 없습니다.
>
> ℹ️ 테스트할 때는 홈 화면의 "영상 수 상한"/"영상당 댓글 수 상한"을 작게
> (예: 5~10) 유지하세요. 유튜브 API 일일 쿼터와 Claude API 비용을 아낄 수 있습니다.

## 다음 단계

다음은 **10단계: 안정화**(에러 핸들링 보강, 대량 데이터 부하 확인)와
**Vercel 배포**입니다.
