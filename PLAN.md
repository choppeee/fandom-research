# 유튜브 팬덤·소셜 리서치 웹앱 MVP 기획 문서

작성일: 2026-07-12
대상: 비개발자 프로덕트 오너 + 개발 협업자
버전: v0.1 (MVP)

---

## 0. 제품 한 줄 정의

키워드(아티스트/브랜드/콘텐츠)를 입력하면 유튜브 영상·댓글을 수집하여
언급량 추이, 연관 키워드, 감성, 팬덤 표현, 구매의향, 이슈/위험 신호를
자동으로 분석해 보여주는 한국어 리서치 대시보드.

---

## 1. MVP 범위

### 1.1 포함 (In Scope)

| 영역 | 내용 |
|---|---|
| 데이터 소스 | 유튜브 영상 메타데이터 + 상위/전체 댓글 (YouTube Data API v3) |
| 검색 방식 | 키워드 1개 + 분석 기간(시작일~종료일) 지정 |
| 분석 | 언급량/참여량 추이, 연관 키워드 빈도, 감성 3분류, 밈/팬덤 표현, 구매의향, 이슈 탐지 |
| 인사이트 | Claude API 기반 종합 요약 리포트 (한국어 서술형) |
| 산출물 | 대시보드 화면 + CSV 다운로드 + PDF 리포트 다운로드 |
| 사용자 | 로그인 1인 기준(팀 협업 기능은 제외), Supabase Auth |
| 비동기 처리 | 수집·분석은 백그라운드 작업(Job)으로 처리, 진행 상태 표시 |

### 1.2 제외 (Out of Scope, 다음 버전 이후)

- 유튜브 외 채널(인스타그램, X, 커뮤니티) 수집
- 다중 키워드 동시 비교 분석
- 실시간(스트리밍) 모니터링, 알림/웹훅
- 팀/조직 단위 권한 관리, 공유 대시보드
- 댓글 작성자 프로필 분석(팔로워 수 등 개인 식별 정보 축적)
- 자동 재수집 스케줄링(크론) — MVP는 수동 실행만

### 1.3 성공 기준 (MVP Definition of Done)

- 키워드 입력 → 수집 → 분석 → 대시보드 확인까지 한 번의 흐름으로 완료
- 영상 200개, 댓글 1만 개 수준 데이터를 10분 이내 처리
- 동일 키워드+기간 재요청 시 중복 수집 없이 캐시된 결과 활용
- 분석 실패 시 자동/수동 재시도 가능
- CSV·PDF 다운로드 정상 동작

---

## 2. 사용자 흐름 (User Flow)

```
[로그인]
   │
   ▼
[홈 / 새 리서치 시작]
   │  - 키워드 입력 (예: "아이브")
   │  - 분석 기간 선택 (예: 최근 30일 / 직접 지정)
   │  - 수집 범위 옵션 (영상 수 상한, 댓글 수 상한)
   │
   ▼
[중복 검사]
   │  - 동일 키워드+기간 조합의 완료된 Job 존재?
   │      ├─ 있음 → 기존 결과 대시보드로 즉시 이동 (재수집 여부 선택 가능)
   │      └─ 없음 → 신규 Job 생성
   ▼
[수집 진행 화면]
   │  - 상태: 대기 → 영상 수집 중 → 댓글 수집 중 → 분석 중 → 완료/실패
   │  - 진행률(%) 표시, 실패 시 재시도 버튼
   ▼
[리서치 대시보드]
   │  - 요약 인사이트(Claude 생성)
   │  - 언급량/참여량 추이 차트
   │  - 연관 키워드 클라우드/랭킹
   │  - 감성 분석 비율 + 시계열
   │  - 팬덤 표현/밈 하이라이트
   │  - 구매의향·광고반응 지표
   │  - 이슈/위험 탐지 알림 카드
   │  - 원문 댓글 샘플 뷰어(필터링)
   ▼
[리포트 다운로드]
   - CSV(원본+분석 결과) / PDF(요약 리포트)
   ▼
[내 리서치 목록]
   - 과거 실행한 Job 히스토리, 재열람, 재실행
```

---

## 3. 화면 목록 (Screens)

| # | 화면명 | 주요 목적 | 핵심 요소 |
|---|---|---|---|
| 1 | 로그인/회원가입 | 사용자 인증 | 이메일 로그인 (Supabase Auth) |
| 2 | 홈 (새 리서치) | 검색 조건 입력 | 키워드 입력창, 기간 선택, 수집 옵션, "분석 시작" 버튼 |
| 3 | 내 리서치 목록 | 과거 Job 조회 | 키워드/기간/상태/생성일 테이블, 검색·필터 |
| 4 | 수집·분석 진행 상태 | 진행률 확인 | 단계별 진행 바, 로그, 실패 시 재시도 |
| 5 | 리서치 대시보드 (메인) | 분석 결과 열람 | 아래 3.1 상세 참조 |
| 6 | 원문 댓글 탐색기 | 원본 데이터 확인 | 감성/키워드/날짜 필터, 페이지네이션, 원문 링크 |
| 7 | 리포트 다운로드 모달 | 산출물 내보내기 | CSV/PDF 선택, 다운로드 진행 표시 |
| 8 | 설정 | API 키/계정 관리 | (관리자용, MVP에서는 최소화) |

### 3.1 대시보드 화면 구성 (섹션 단위)

1. 상단 요약 카드: 총 영상 수, 총 댓글 수, 분석 기간, Claude 종합 인사이트(3~5문단)
2. 언급량·참여량 추이 (Recharts 라인/바 차트, 날짜별)
3. 연관 키워드 Top 20 (바 차트 또는 태그 클라우드)
4. 감성 분석 (파이차트 + 날짜별 감성 추이 스택 바)
5. 팬덤 표현·밈 하이라이트 (빈도 상위 표현 + 예시 댓글 인용 카드)
6. 구매의향/광고반응 지표 (긍정 반응 비율, 대표 댓글 예시)
7. 이슈·위험 탐지 카드 (경고 등급별, 근거 댓글 링크 포함)
8. 원문 데이터 바로가기 버튼

---

## 4. 데이터베이스 스키마 (Supabase / PostgreSQL)

설계 원칙: **원문 데이터**와 **AI 분석 결과**를 물리적으로 분리된 테이블에 저장하고,
중복 수집 방지를 위해 자연키(natural key)에 유니크 제약을 건다.

```sql
-- =========================================
-- 1. 사용자 (Supabase Auth 기본 auth.users 사용, 아래는 확장 프로필)
-- =========================================
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz default now()
);

-- 신규 회원가입 시 profiles row 자동 생성
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS: 본인 프로필만 조회/수정 가능
alter table profiles enable row level security;

create policy "profiles_select_own"
  on profiles for select
  using (auth.uid() = id);

create policy "profiles_update_own"
  on profiles for update
  using (auth.uid() = id);

-- =========================================
-- 2. 리서치 작업 단위 (검색 조건 = Job)
-- =========================================
create table research_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  keyword text not null,
  period_start date not null,
  period_end date not null,
  max_videos int not null default 200,
  max_comments_per_video int not null default 100,
  status text not null default 'pending',
    -- pending | collecting_videos | collecting_comments | analyzing | done | failed
  progress int not null default 0, -- 0~100
  error_message text,
  retry_count int not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, keyword, period_start, period_end) -- 동일 조건 중복 실행 방지
);

-- RLS: 본인 소유 Job만 조회/생성/수정 가능
-- (youtube_videos/comments/comment_analysis/job_insights는 RLS를 걸지 않고,
--  서버 API 라우트가 research_jobs 소유권을 먼저 확인한 뒤 admin 클라이언트로 접근한다)
alter table research_jobs enable row level security;

create policy "research_jobs_select_own"
  on research_jobs for select
  using (auth.uid() = user_id);

create policy "research_jobs_insert_own"
  on research_jobs for insert
  with check (auth.uid() = user_id);

create policy "research_jobs_update_own"
  on research_jobs for update
  using (auth.uid() = user_id);

-- =========================================
-- 3. 원문: 영상 메타데이터
-- =========================================
create table youtube_videos (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references research_jobs(id) on delete cascade,
  video_id text not null,        -- 유튜브 영상 고유 ID
  channel_id text,
  channel_title text,
  title text,
  description text,
  published_at timestamptz,
  view_count bigint,
  like_count bigint,
  comment_count bigint,
  collected_at timestamptz default now(),
  unique (video_id, job_id)      -- Job 단위 중복 저장 방지
);
create index idx_videos_job on youtube_videos(job_id);

-- =========================================
-- 4. 원문: 댓글
-- =========================================
create table youtube_comments (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references research_jobs(id) on delete cascade,
  video_id text not null,
  comment_id text not null,      -- 유튜브 댓글 고유 ID
  author_display text,           -- 표시용 닉네임만 저장 (개인식별정보 최소화)
  text_original text not null,
  like_count int default 0,
  published_at timestamptz,
  collected_at timestamptz default now(),
  unique (comment_id)            -- 전역 중복 방지 (동일 댓글 재수집 차단)
);
create index idx_comments_job on youtube_comments(job_id);
create index idx_comments_video on youtube_comments(video_id);

-- =========================================
-- 5. AI 분석 결과 (댓글 단위 감성/속성)
--    JSON Schema 기반 구조화 출력을 그대로 저장
-- =========================================
create table comment_analysis (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references research_jobs(id) on delete cascade,
  comment_id text references youtube_comments(comment_id) on delete cascade,
  sentiment text,                 -- positive | negative | neutral
  purchase_intent boolean,
  ad_reaction text,                -- positive | negative | none
  risk_flag text,                  -- none | caution | high_risk
  extracted_keywords text[],
  fandom_expressions text[],
  raw_json jsonb not null,         -- 모델 원본 구조화 출력 전체 보관
  model_version text,
  analyzed_at timestamptz default now(),
  unique (comment_id)              -- 댓글당 최신 분석 1건 유지
);
create index idx_analysis_job on comment_analysis(job_id);

-- =========================================
-- 6. AI 종합 인사이트 (Job 단위 요약)
-- =========================================
create table job_insights (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references research_jobs(id) on delete cascade unique,
  summary_text text,               -- Claude 종합 서술형 인사이트
  top_keywords jsonb,              -- [{keyword, count}, ...]
  sentiment_ratio jsonb,           -- {positive: %, negative: %, neutral: %}
  daily_trend jsonb,               -- [{date, mentions, engagement}, ...]
  fandom_highlights jsonb,         -- [{expression, count, example}, ...]
  purchase_intent_summary jsonb,
  risk_alerts jsonb,               -- [{level, description, example_comment_id}, ...]
  raw_json jsonb not null,
  model_version text,
  generated_at timestamptz default now()
);

-- =========================================
-- 7. 분석 작업 큐 / 재시도 관리
-- =========================================
create table analysis_tasks (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references research_jobs(id) on delete cascade,
  task_type text not null,   -- comment_batch | insight_summary
  status text not null default 'pending', -- pending | processing | success | failed
  attempt_count int not null default 0,
  max_attempts int not null default 3,
  last_error text,
  payload jsonb,             -- 배치 처리 대상 comment_id 목록 등
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index idx_tasks_status on analysis_tasks(status);
```

-- =========================================
-- 8. 플랫폼 확장(X/Web) + 비동기 분석 아키텍처용 테이블
--    (analysis_tasks는 7번에서 이미 정의된 것을 그대로 사용)
-- =========================================

-- 기존 유튜브 테이블에 platform 컬럼 추가 (하위호환, 기본값 youtube)
alter table youtube_videos add column if not exists platform text not null default 'youtube';
alter table youtube_comments add column if not exists platform text not null default 'youtube';

-- 범용 소셜 포스트 테이블 (X, 향후 Web 등 비-유튜브 플랫폼)
create table if not exists social_posts (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references research_jobs(id) on delete cascade,
  platform text not null,              -- x | web | ...
  external_id text not null,           -- 플랫폼 고유 게시물 ID
  url text,
  author text,
  text_original text not null,
  created_at timestamptz,
  like_count int default 0,
  share_count int default 0,           -- retweet/repost
  reply_count int default 0,
  quote_count int default 0,
  language text,
  hashtags text[],
  mentions text[],
  referenced_post_id text,
  search_query text,                   -- 어떤 확장 검색어로 수집됐는지
  collected_at timestamptz default now(),
  raw_json jsonb,
  unique (platform, external_id)
);
create index if not exists idx_social_posts_job on social_posts(job_id);

-- social_posts 단위 AI 분석 (youtube_comments의 comment_analysis와 동일 역할)
create table if not exists post_analysis (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references research_jobs(id) on delete cascade,
  post_id uuid references social_posts(id) on delete cascade,
  sentiment text,
  purchase_intent boolean,
  ad_reaction text,
  risk_flag text,
  extracted_keywords text[],
  fandom_expressions text[],
  raw_json jsonb not null,
  model_version text,
  analyzed_at timestamptz default now(),
  unique (post_id)
);
create index if not exists idx_post_analysis_job on post_analysis(job_id);

-- 모듈별 심층 분석 결과 (Observation→Evidence→Interpretation→Psychology→Strategy→Action 구조)
create table if not exists job_analysis_modules (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references research_jobs(id) on delete cascade,
  module_key text not null,        -- audience_perception | character_traits | ...
  platform text,                   -- youtube | x | cross | null(IP 전체)
  title text,
  content_md text,
  evidence jsonb,
  confidence text,                 -- high | medium | low
  model_version text,
  created_at timestamptz default now(),
  unique (job_id, module_key)
);
create index if not exists idx_analysis_modules_job on job_analysis_modules(job_id);

-- job_insights: 검증된 외부 레퍼런스(실제 검색 결과 URL만)
alter table job_insights add column if not exists research_references jsonb;

-- job_insights: PDF 시각화 페이지(Diagnostic/Funnel/Character Architecture/
-- Opportunity Matrix)용 구조화 데이터. 기존 분석 모듈을 근거로 추출하며,
-- 근거 없는 항목은 비워둔다(추측 금지 원칙).
alter table job_insights add column if not exists visual_data jsonb;

-- 태스크 큐 조회 성능용 복합 인덱스
create index if not exists idx_tasks_job_status on analysis_tasks(job_id, status);

**중복 방지 핵심 규칙**
- `research_jobs`: (user_id, keyword, period_start, period_end) 유니크 → 동일 조건 재검색 시 기존 Job 재사용
- `youtube_videos`: (video_id, job_id) 유니크 → Job 내 재수집 방지
- `youtube_comments`: comment_id 전역 유니크 → 여러 Job에서 같은 댓글 중복 저장 방지(단, job_id로 소속은 구분)
- `comment_analysis`, `job_insights`: comment_id / job_id 유니크 → 재분석 시 upsert로 최신 결과 유지, 이전 결과는 필요 시 별도 이력 테이블로 확장 가능

---

## 5. API 구조 (Next.js Route Handlers)

원칙: **모든 외부 API 키(YouTube, Anthropic, Supabase Service Role)는 서버 사이드(API Route)에서만 사용**하며 클라이언트 번들에 절대 포함하지 않는다.

```
/app/api
├── jobs/
│   ├── route.ts               POST  새 리서치 Job 생성 (중복 검사 포함)
│   │                          GET   내 Job 목록 조회
│   └── [jobId]/
│       ├── route.ts           GET   Job 상세/상태 조회
│       ├── collect/route.ts   POST  (내부) 영상+댓글 수집 트리거
│       ├── analyze/route.ts   POST  (내부) 댓글 배치 분석 트리거
│       ├── insight/route.ts   POST  (내부) Claude 종합 인사이트 생성
│       ├── retry/route.ts     POST  실패한 task 재시도
│       └── export/
│           ├── csv/route.ts   GET   CSV 다운로드
│           └── pdf/route.ts   GET   PDF 리포트 다운로드
│
├── comments/
│   └── route.ts               GET   필터링된 원문 댓글 목록 (감성/키워드/날짜)
│
└── cron/  (선택, Vercel Cron 사용 시)
    └── process-tasks/route.ts POST  대기 중인 analysis_tasks 배치 처리
```

### 5.1 주요 API 계약 예시

**POST /api/jobs**
```json
// Request
{ "keyword": "아이브", "periodStart": "2026-06-01", "periodEnd": "2026-06-30",
  "maxVideos": 200, "maxCommentsPerVideo": 100 }

// Response (기존 Job 존재 시)
{ "jobId": "uuid", "status": "done", "reused": true }

// Response (신규 생성 시)
{ "jobId": "uuid", "status": "pending", "reused": false }
```

**GET /api/jobs/{jobId}**
```json
{
  "jobId": "uuid",
  "status": "analyzing",
  "progress": 62,
  "videoCount": 180,
  "commentCount": 8400,
  "errorMessage": null
}
```

**GET /api/jobs/{jobId}/insight** (대시보드 데이터 소스)
```json
{
  "summaryText": "...",
  "topKeywords": [{"keyword": "컴백", "count": 342}],
  "sentimentRatio": {"positive": 61, "negative": 12, "neutral": 27},
  "dailyTrend": [{"date": "2026-06-01", "mentions": 120, "engagement": 4300}],
  "fandomHighlights": [{"expression": "언니 최고", "count": 88, "example": "..."}],
  "purchaseIntentSummary": {"positiveRatio": 34, "examples": ["..."]},
  "riskAlerts": [{"level": "caution", "description": "...", "exampleCommentId": "..."}]
}
```

### 5.2 처리 방식 (동기 vs 비동기)

- 영상/댓글 수집, 댓글 배치 분석은 시간이 오래 걸리므로 **Job 생성 즉시 202 응답 + 상태 폴링(polling)** 방식 사용
- 클라이언트는 `/api/jobs/{jobId}` 를 3~5초 간격으로 폴링하여 진행률 표시
- 댓글 분석은 Claude API 호출을 배치(예: 20~30개 댓글씩 묶어 1회 호출)로 나누어 `analysis_tasks`에 기록, 실패 시 해당 배치만 재시도

---

## 6. 구현 순서 (단계별 개발 로드맵)

작은 단위로 나누어 각 단계마다 눈으로 확인 가능한 결과물을 만든다.

| 단계 | 목표 | 완료 기준 |
|---|---|---|
| 0단계 | 프로젝트 뼈대 구축 | Next.js + TS + Tailwind + shadcn/ui 세팅, Supabase 연결, Vercel 배포 파이프라인 확인 |
| 1단계 | 인증 | Supabase Auth 로그인/로그아웃 동작 |
| 2단계 | Job 생성 + DB 스키마 반영 | 키워드/기간 입력 폼 → `research_jobs` row 생성, 중복 검사 동작 확인 |
| 3단계 | YouTube 영상 수집 | Data API로 영상 목록 수집 → `youtube_videos` 저장, 진행 상태 화면 표시 |
| 4단계 | YouTube 댓글 수집 | 영상별 댓글 수집 → `youtube_comments` 저장, 중복 comment_id 스킵 확인 |
| 5단계 | 댓글 감성/속성 분석 (Claude) | JSON Schema 구조화 출력 설계 → 배치 분석 → `comment_analysis` 저장, 실패 재시도 테스트 |
| 6단계 | 종합 인사이트 생성 | Job 전체 데이터 요약 프롬프트 → `job_insights` 저장 |
| 7단계 | 대시보드 UI | Recharts로 추이/감성/키워드 차트 구현, 요약 카드 표시 |
| 8단계 | 원문 댓글 탐색기 | 필터링 가능한 댓글 목록 화면 |
| 9단계 | CSV/PDF 내보내기 | 원문+분석 결과 CSV, 요약 PDF 생성 |
| 10단계 | 안정화 | 에러 핸들링, 재시도 UX, 대량 데이터(테스트 키워드) 부하 확인 |
| 11단계 | 문서화 | README, 운영 가이드, 트러블슈팅 문서 작성 |

각 단계는 독립적으로 배포·테스트 가능하도록 설계하며, 이전 단계가 끝나기 전 다음 단계로 넘어가지 않는다.

---

## 7. 예상 위험 요소 (Risks)

| 구분 | 위험 | 대응 방안 |
|---|---|---|
| API 쿼터 | YouTube Data API는 일일 쿼터(기본 1만 유닛) 제한이 있어 검색/댓글 수집량이 큰 키워드는 쿼터 소진 가능 | 요청당 수집 상한(maxVideos/maxComments) 설정, 쿼터 소진 시 Job을 pending 상태로 유지 후 익일 재개 |
| 비용 | Claude API 호출량이 댓글 수에 비례해 증가 → 비용 급증 가능 | 배치 크기 최적화, 댓글 샘플링(중복/스팸 제거 후 분석), 사용자별 월 한도 설정 |
| 데이터 품질 | 스팸/봇 댓글, 광고성 댓글이 분석 결과를 왜곡할 수 있음 | 수집 단계에서 1차 필터링(초단문, 반복 패턴, URL 포함 댓글 별도 표시) |
| 분석 신뢰도 | LLM 감성/이슈 판단이 100% 정확하지 않음 | 구조화 출력에 신뢰도(confidence) 필드 포함 검토, 대시보드에 "AI 추정치" 명시 |
| 처리 시간 | 댓글 수만 개 이상 시 실시간성 저해 | 비동기 큐 + 배치 처리, 진행률 UI로 체감 대기시간 완화 |
| 중복/유사 검색 | 같은 키워드를 여러 기간으로 쪼개 검색 시 데이터 정합성 관리 필요 | Job 단위로 기간을 명확히 구분해 저장, 기간 겹침 경고 표시(추후) |
| 배포 환경 | Vercel 서버리스 함수는 실행 시간 제한이 있어 장시간 수집 작업에 부적합 | 수집/분석 로직을 작은 단위로 쪼개 여러 번 호출되는 큐 방식으로 설계(단일 함수에서 전체 처리 지양) |
| 다국어 댓글 | 유튜브 댓글에 외국어가 섞여 분석 정확도 저하 가능 | 언어 감지 후 한국어 우선 분석, 비한국어는 별도 표시 또는 번역 옵션(추후) |

---

## 8. 개인정보 및 크롤링 관련 주의사항

### 8.1 YouTube 서비스 약관 준수

- YouTube Data API의 **이용 약관(YouTube API Services Terms of Service)** 및 **개발자 정책(Developer Policies)** 을 반드시 준수해야 한다.
- 공식 API를 통하지 않는 스크래핑(HTML 크롤링)은 약관 위반 소지가 크므로 **본 프로젝트는 반드시 공식 YouTube Data API v3만 사용**한다.
- API로 가져온 데이터는 YouTube 정책상 **저장 기간 제한**이 있을 수 있으므로(정책 변경 가능성 있음), 최신 개발자 정책을 주기적으로 확인하고 필요 시 데이터 갱신/삭제 로직을 마련한다.
- 수집한 콘텐츠(댓글 원문, 영상 제목 등)를 외부에 재게시하거나 상업적으로 재배포하지 않는다. 본 서비스는 내부 리서치/분석 목적에 한정한다.

### 8.2 개인정보 최소화 원칙

- 댓글 작성자의 **표시 닉네임(author_display)** 정도만 저장하고, 프로필 사진 URL, 채널 URL 등 추가 식별 정보는 MVP에서는 저장하지 않는다.
- 이메일, 전화번호 등 댓글 본문에 포함될 수 있는 개인정보(PII)가 분석/리포트에 그대로 노출되지 않도록, 리포트 생성 시 **PII 마스킹 필터**를 검토한다(향후 단계에서 정규식 기반 1차 마스킹 적용 권장).
- 아동·청소년 관련 콘텐츠(예: 미성년 아티스트 팬덤)를 다룰 경우, 댓글 작성자 신원 특정 목적의 분석은 하지 않는다.

### 8.3 데이터 보관 및 삭제

- 사용자가 Job을 삭제하면 관련 원문 데이터(`youtube_videos`, `youtube_comments`)와 분석 결과(`comment_analysis`, `job_insights`)를 **연쇄 삭제(cascade)** 하도록 설계한다(위 스키마의 `on delete cascade` 참고).
- 장기 미사용 Job(예: 1년 이상)에 대한 자동 정리(retention) 정책을 추후 도입 검토한다.

### 8.4 저작권

- 영상 제목, 설명, 댓글 원문은 각 게시자에게 저작권이 있다. 본 서비스는 **분석 목적의 내부 열람**으로 한정하고, 원문을 그대로 재출판하는 기능(예: 댓글 원문을 대량으로 외부 공개)은 포함하지 않는다.
- PDF/CSV 리포트에는 분석 결과와 함께 소량의 예시 인용만 포함하고, 출처(영상 링크)를 함께 표기한다.

### 8.5 API 키 및 보안

- YouTube Data API Key, Anthropic API Key, Supabase Service Role Key는 모두 **서버 환경변수**(`.env`, Vercel Environment Variables)로만 관리하며 클라이언트 코드/번들에 포함하지 않는다.
- Supabase에는 Row Level Security(RLS)를 적용하여 사용자가 본인 소유 Job/데이터만 조회 가능하도록 제한한다.

---

## 다음 단계

이 문서 승인 후, "0단계: 프로젝트 뼈대 구축"부터 실제 코드 작업을 시작합니다.
각 단계 완료 시마다 결과를 확인받고 다음 단계로 진행합니다.
