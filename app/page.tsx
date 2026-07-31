import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

function PerceptionBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-14 shrink-0 text-xs text-muted-foreground">{label}</span>
      <div className="h-2 flex-1 rounded-full bg-muted">
        <div className="h-2 rounded-full" style={{ width: `${value}%`, background: color }} />
      </div>
      <span className="w-6 shrink-0 text-right text-xs font-semibold">{value}</span>
    </div>
  );
}

function MiniBars({ color }: { color: string }) {
  const values = [62, 88, 45, 74];
  return (
    <svg viewBox="0 0 120 48" className="h-12 w-full">
      {values.map((v, i) => (
        <rect
          key={i}
          x={i * 30 + 6}
          y={48 - v * 0.4}
          width={16}
          height={v * 0.4}
          rx={3}
          fill={color}
          opacity={0.35 + i * 0.15}
        />
      ))}
    </svg>
  );
}

function MiniDonut({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 48 48" className="h-12 w-12">
      <circle cx={24} cy={24} r={18} fill="none" stroke="hsl(var(--muted))" strokeWidth={8} />
      <circle
        cx={24}
        cy={24}
        r={18}
        fill="none"
        stroke={color}
        strokeWidth={8}
        strokeDasharray={`${2 * Math.PI * 18 * 0.68} ${2 * Math.PI * 18}`}
        strokeLinecap="round"
        transform="rotate(-90 24 24)"
      />
    </svg>
  );
}

function MiniLine({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 120 48" className="h-12 w-full">
      <polyline
        points="4,36 24,28 44,32 64,14 84,20 104,6 116,10"
        fill="none"
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const CAPABILITIES = [
  {
    key: "audience_perception",
    title: "AUDIENCE PERCEPTION",
    desc: "사람들이 이 IP를 어떤 존재로 인식하는지 분석합니다.",
    visual: "bars",
  },
  {
    key: "appeal_drivers",
    title: "APPEAL DRIVERS",
    desc: "사람들이 왜 좋아하고 반응하는지 발견합니다.",
    visual: "line",
  },
  {
    key: "conversion_signals",
    title: "CONVERSION SIGNAL",
    desc: "관심이 팬·구매·구독으로 바뀌는 순간을 찾습니다.",
    visual: "donut",
  },
  {
    key: "character_traits",
    title: "CHARACTER INTELLIGENCE",
    desc: "어떤 캐릭터와 포지션이 매력적으로 작동하는지 분석합니다.",
    visual: "bars",
  },
  {
    key: "viral_mechanics",
    title: "VIRAL SIGNAL",
    desc: "밈, 관계성, 장면 등 온라인에서 확산되는 요소를 찾습니다.",
    visual: "line",
  },
  {
    key: "hidden_value",
    title: "HIDDEN VALUE",
    desc: "운영자는 강조하지 않지만 대중이 이미 반응하는 가치를 발견합니다.",
    visual: "donut",
  },
  {
    key: "positioning_strategy",
    title: "POSITIONING OPPORTUNITY",
    desc: "다음 콘텐츠·브랜딩·마케팅에서 강화해야 할 방향을 제안합니다.",
    visual: "bars",
  },
] as const;

const USE_CASES = [
  { tag: "콘텐츠 기획 전", q: "이 사람이 어떤 모습일 때 가장 반응이 좋은가?" },
  { tag: "브랜드 전략 수립", q: "소비자는 우리가 생각하는 이유로 이 브랜드를 좋아하고 있는가?" },
  { tag: "신제품 분석", q: "구매를 일으키는 진짜 USP는 무엇인가?" },
  { tag: "아티스트 전략", q: "기존 팬과 신규 유입은 어떤 매력에 각각 반응하는가?" },
  { tag: "캠페인 리뷰", q: "무엇이 화제가 되었고 무엇은 반응하지 않았는가?" },
];

const HOW_IT_WORKS = [
  { step: "01", title: "Collect", desc: "YouTube·X 등 온라인 반응 데이터를 수집합니다." },
  { step: "02", title: "Understand", desc: "감성·화제성·타겟 반응을 1차 분류합니다." },
  { step: "03", title: "Discover", desc: "심리적 동인과 숨은 가치를 심층 분석합니다." },
  { step: "04", title: "Strategize", desc: "포지셔닝과 실행 전략을 구체적으로 제안합니다." },
];

const VISUALS = { bars: MiniBars, donut: MiniDonut, line: MiniLine };

export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const primaryHref = user ? "/dashboard" : "/login";
  const primaryLabel = user ? "대시보드로 이동" : "분석 시작하기";

  return (
    <main className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <span className="text-xs font-semibold tracking-[0.2em] text-foreground">
          FANDOM RESEARCH
        </span>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="#capabilities" className="hidden text-muted-foreground hover:text-foreground sm:inline">
            기능
          </Link>
          <Link href="#use-cases" className="hidden text-muted-foreground hover:text-foreground sm:inline">
            활용 사례
          </Link>
          {user ? (
            <Link
              href="/dashboard"
              className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground"
            >
              대시보드
            </Link>
          ) : (
            <>
              <Link href="/login" className="text-muted-foreground hover:text-foreground">
                로그인
              </Link>
              <Link
                href="/login"
                className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground"
              >
                무료로 시작하기
              </Link>
            </>
          )}
        </nav>
      </header>

      {/* 01 HERO */}
      <section className="mx-auto grid w-full max-w-6xl gap-12 px-6 pb-24 pt-12 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:pt-20">
        <div className="space-y-6">
          <p className="text-xs font-semibold tracking-[0.2em] text-primary">
            AUDIENCE &amp; IP INTELLIGENCE
          </p>
          <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            사람들이 왜 반응하는지
            <br />
            궁금할 때
          </h1>
          <p className="text-lg font-medium text-foreground/80">
            대중의 반응에서, IP의 다음 기회를 찾습니다.
          </p>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
            YouTube와 온라인 반응 데이터를 분석해 대중이 무엇을 좋아하고, 왜 반응하며,
            어떤 방향으로 성장할 수 있는지 발견합니다.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              href={primaryHref}
              className="rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
            >
              {primaryLabel}
            </Link>
            <Link
              href="#sample-insight"
              className="rounded-md border border-border px-6 py-3 text-sm font-semibold hover:bg-muted"
            >
              샘플 인사이트 보기
            </Link>
          </div>
        </div>

        {/* Product preview mock */}
        <div className="rounded-2xl border border-border bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_16px_40px_-16px_rgba(0,0,0,0.12)]">
          <p className="mb-4 text-xs font-semibold tracking-widest text-muted-foreground">
            AUDIENCE PERCEPTION
          </p>
          <div className="space-y-2.5">
            <PerceptionBar label="친근함" value={84} color="hsl(var(--primary))" />
            <PerceptionBar label="동경" value={61} color="hsl(var(--primary))" />
            <PerceptionBar label="예능감" value={78} color="hsl(var(--primary))" />
          </div>
          <div className="my-5 border-t border-border" />
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold tracking-widest text-muted-foreground">
              CONVERSION SIGNAL
            </p>
            <p className="text-2xl font-bold text-primary">+34%</p>
          </div>
          <div className="my-5 border-t border-border" />
          <p className="mb-2 text-xs font-semibold tracking-widest text-muted-foreground">
            HIDDEN OPPORTUNITY
          </p>
          <p className="rounded-lg bg-muted p-3 text-sm leading-relaxed">
            &ldquo;완벽함보다 인간적인 허점에서
            <br />
            신규 유입 반응이 강하게 발생&rdquo;
          </p>
        </div>
      </section>

      {/* 02 TRUST / DATA */}
      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-6 px-6 py-10 sm:grid-cols-4">
          {[
            { label: "YouTube", sub: "영상 · 댓글 분석" },
            { label: "X (Twitter)", sub: "게시물 분석 · 베타" },
            { label: "Claude AI", sub: "심층 심리·전략 분석" },
            { label: "10+", sub: "전문 분석 모듈" },
          ].map((item) => (
            <div key={item.label} className="text-center">
              <p className="text-xl font-bold">{item.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{item.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 03 CAPABILITIES */}
      <section id="capabilities" className="mx-auto w-full max-w-6xl px-6 py-24">
        <div className="mb-12 max-w-lg">
          <p className="text-xs font-semibold tracking-[0.2em] text-primary">CAPABILITIES</p>
          <h2 className="mt-3 text-2xl font-bold sm:text-3xl">
            무엇을 분석할 수 있나요
          </h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map((cap) => {
            const Visual = VISUALS[cap.visual];
            return (
              <div key={cap.key} className="rounded-xl border border-border bg-white p-6">
                <Visual color="hsl(var(--primary))" />
                <p className="mt-4 text-xs font-semibold tracking-widest text-foreground">
                  {cap.title}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{cap.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* 04 PRODUCT PREVIEW */}
      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto w-full max-w-6xl px-6 py-24">
          <div className="mb-12 max-w-lg">
            <p className="text-xs font-semibold tracking-[0.2em] text-primary">PRODUCT PREVIEW</p>
            <h2 className="mt-3 text-2xl font-bold sm:text-3xl">
              리포트가 아니라, 전략 문서입니다
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              수집된 데이터는 감성 분류에서 끝나지 않고, 심리적 동인·포지셔닝 기회까지
              이어지는 하나의 전략 리포트로 완성됩니다.
            </p>
          </div>
          <div className="grid gap-6 rounded-2xl border border-border bg-white p-8 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_24px_60px_-24px_rgba(0,0,0,0.14)] lg:grid-cols-[1fr_1fr_1.2fr]">
            <div>
              <p className="mb-3 text-xs font-semibold tracking-widest text-muted-foreground">
                SENTIMENT
              </p>
              <MiniDonut color="hsl(var(--primary))" />
              <p className="mt-3 text-sm">
                긍정 <span className="font-semibold">68%</span>
              </p>
            </div>
            <div>
              <p className="mb-3 text-xs font-semibold tracking-widest text-muted-foreground">
                TOP KEYWORDS
              </p>
              <MiniBars color="hsl(var(--primary))" />
            </div>
            <div>
              <p className="mb-3 text-xs font-semibold tracking-widest text-muted-foreground">
                STRATEGIC IMPLICATION
              </p>
              <p className="text-sm leading-relaxed text-foreground/90">
                반복되는 반응 패턴을 근거로, 다음 콘텐츠·커뮤니케이션에서 어떤 지점을
                강화해야 하는지까지 구체적으로 제시합니다.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 05 USE CASES */}
      <section id="use-cases" className="mx-auto w-full max-w-6xl px-6 py-24">
        <div className="mb-12 max-w-lg">
          <p className="text-xs font-semibold tracking-[0.2em] text-primary">USE CASES</p>
          <h2 className="mt-3 text-2xl font-bold sm:text-3xl">언제 사용하나요</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {USE_CASES.map((uc) => (
            <div key={uc.tag} className="rounded-xl border border-border p-6">
              <p className="text-xs font-semibold tracking-widest text-primary">{uc.tag}</p>
              <p className="mt-3 text-sm leading-relaxed">&ldquo;{uc.q}&rdquo;</p>
            </div>
          ))}
        </div>
      </section>

      {/* 06 HOW IT WORKS */}
      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto w-full max-w-6xl px-6 py-24">
          <div className="mb-12 max-w-lg">
            <p className="text-xs font-semibold tracking-[0.2em] text-primary">HOW IT WORKS</p>
            <h2 className="mt-3 text-2xl font-bold sm:text-3xl">4단계로 작동합니다</h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {HOW_IT_WORKS.map((s) => (
              <div key={s.step}>
                <p className="text-3xl font-bold text-primary/30">{s.step}</p>
                <p className="mt-2 text-base font-semibold">{s.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 07 SAMPLE INSIGHT */}
      <section id="sample-insight" className="mx-auto w-full max-w-4xl px-6 py-24">
        <div className="mb-10 max-w-lg">
          <p className="text-xs font-semibold tracking-[0.2em] text-primary">SAMPLE INSIGHT</p>
          <h2 className="mt-3 text-2xl font-bold sm:text-3xl">이런 방식으로 분석합니다</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            실제 리포트의 분석 구조를 보여주는 예시입니다 (특정 사례가 아닌 일반화된 예시).
          </p>
        </div>
        <div className="space-y-4 rounded-2xl border border-border p-8">
          <p className="text-xs font-semibold tracking-widest text-muted-foreground">
            OBSERVATION → STRATEGIC MEANING
          </p>
          <p className="text-lg font-semibold leading-snug">
            신규 유입은 완성된 이미지가 아니라, 예상 밖의 인간적인 순간을 진입점으로 삼는다.
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">Evidence</span> — 최고 반응 콘텐츠 상위
            구간에서 반복적으로 &ldquo;의외의 허점&rdquo;, &ldquo;꾸미지 않은 순간&rdquo;에 대한
            호감 표현이 관찰됨. 완성도에 대한 감탄보다 압도적으로 높은 비중.
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">Strategic Meaning</span> — 신규 유입
            확대를 목표로 한다면, 정제된 이미지보다 예측 불가능한 순간을 의도적으로
            노출하는 콘텐츠 전략이 더 효과적인 진입점이 될 수 있음.
          </p>
        </div>
      </section>

      {/* 08 CTA */}
      <section className="mx-auto w-full max-w-3xl px-6 py-28 text-center">
        <h2 className="text-2xl font-bold leading-snug sm:text-3xl">
          대중이 무엇을 말하는지가 아니라,
          <br />왜 그렇게 말하는지 발견하세요.
        </h2>
        <div className="mt-8">
          <Link
            href={primaryHref}
            className="inline-block rounded-md bg-primary px-8 py-3.5 text-sm font-semibold text-primary-foreground"
          >
            {primaryLabel}
          </Link>
        </div>
      </section>

      <footer className="border-t border-border px-6 py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Fandom Research
      </footer>
    </main>
  );
}
