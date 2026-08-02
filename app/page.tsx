import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BRAND_MANIFESTO } from "@/lib/brand";
import { RabbitStaffScene } from "@/components/report/RabbitStaffScene";
import { LandingSearchPanel } from "@/components/landing/LandingSearchPanel";

const REPORT_CARDS = [
  {
    title: "Executive Decision",
    desc: "한 페이지로 정리된 의사결정 요약",
  },
  {
    title: "Audience Psychology",
    desc: "사람들이 반응하는 이유와 심리 메커니즘 분석",
  },
  {
    title: "Coverage Audit",
    desc: "데이터의 범위와 편향, 신뢰도를 점검",
  },
  {
    title: "Meeting Guide",
    desc: "회의에서 바로 사용할 수 있는 질문과 논의 포인트",
  },
] as const;

const PIPELINE_STEPS = [
  { en: "Evidence", ko: "수집" },
  { en: "Pattern", ko: "발견" },
  { en: "Reasoning", ko: "추론" },
  { en: "Decision", ko: "결론" },
  { en: "Meeting", ko: "전환" },
] as const;

export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 로그인 사용자는 이 페이지(설득용 Landing)를 다시 볼 이유가 없다 - Workspace로 바로 보낸다.
  const primaryHref = user ? "/dashboard" : "/login";
  const primaryLabel = user ? "Workspace로 이동" : "무료로 시작하기";

  return (
    <main className="flex min-h-screen flex-col bg-[#0F1012] text-white">
      {/* Header - 실제 존재하는 라우트만 노출한다(가짜 메뉴 금지) */}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <span className="flex items-center gap-1.5 text-xs font-semibold tracking-[0.2em]">
          <span className="text-[#E3262E]">✦</span> FANDOM RESEARCH
        </span>
        <nav className="flex items-center gap-4 text-sm">
          {user ? (
            <Link href="/dashboard" className="rounded-md bg-[#E3262E] px-4 py-2 font-medium text-white">
              Workspace
            </Link>
          ) : (
            <>
              <Link href="/login" className="text-white/50 hover:text-white">
                로그인
              </Link>
              <Link href="/login" className="rounded-md bg-[#E3262E] px-4 py-2 font-medium text-white">
                무료로 시작하기
              </Link>
            </>
          )}
        </nav>
      </header>

      {/* 01 HERO */}
      <section className="mx-auto grid w-full max-w-6xl gap-12 px-6 pb-20 pt-12 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:pt-16">
        <div className="space-y-8">
          {/* 1. Hero Headline - 가장 크다 */}
          <h1 className="reveal-up text-5xl font-extrabold leading-[1.15] tracking-tight sm:text-6xl" style={{ animationDelay: "0s" }}>
            좋은 결정은
            <br />
            준비된 회의에서
            <br />
            시작됩니다.
          </h1>

          {/* 2. Brand Manifesto - Headline보다 작고 Description보다 크다. lib/brand.ts의
              문장을 그대로 쓴다 - 여기서 새로 짓지 않는다. */}
          <p
            className="reveal-up border-l-2 border-[#E3262E] pl-5 text-2xl font-semibold leading-snug text-white/90 sm:text-3xl"
            style={{ animationDelay: "0.15s" }}
          >
            {BRAND_MANIFESTO}
          </p>

          {/* 3. Product Description - 가장 작다 */}
          <div className="reveal-up space-y-1.5" style={{ animationDelay: "0.3s" }}>
            <p className="text-xs font-semibold tracking-[0.15em] text-white/40">
              YOUTUBE · SNS · REVIEWS · VOC
            </p>
            <p className="max-w-md text-sm leading-relaxed text-white/60">
              흩어진 정성 데이터를 연결하여 회의에서 바로 사용할 수 있는 Decision
              Intelligence를 제공합니다.
            </p>
          </div>
        </div>

        {/* Situation Room 세계관 - 공간이 주인공, 캐릭터는 작게 */}
        <div className="reveal-up h-[320px] overflow-hidden rounded-2xl border border-white/10 bg-[#17181B] lg:h-[380px]" style={{ animationDelay: "0.2s" }}>
          <RabbitStaffScene milestones={new Set(["whiteboard", "materials", "projector", "table", "lightsOn"])} />
        </div>
      </section>

      {/* 02 SEARCH PANEL */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-24">
        <LandingSearchPanel />
      </section>

      {/* 03 이 리포트가 만드는 것 */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-24">
        <p className="mb-8 text-lg font-bold">이 리포트가 만드는 것</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {REPORT_CARDS.map((card) => (
            <div
              key={card.title}
              className="rounded-xl border border-white/10 bg-[#17181B] p-6 transition-colors hover:border-[#E3262E]/40"
            >
              <span className="mb-4 inline-block h-6 w-6 rounded border border-[#E3262E]/50" />
              <p className="text-sm font-semibold">{card.title}</p>
              <p className="mt-2 text-xs leading-relaxed text-white/50">{card.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 04 우리는 이렇게 일합니다 (Pipeline) */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-28">
        <p className="mb-10 text-lg font-bold">우리는 이렇게 일합니다</p>
        <div className="flex items-start">
          {PIPELINE_STEPS.map((step, i) => (
            <div key={step.en} className="flex flex-1 items-start">
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="relative flex h-3 w-3 items-center justify-center">
                  <span
                    className="pipeline-pulse absolute inline-block h-2 w-2 rounded-full bg-[#E3262E]"
                    style={{ animationDelay: `${i * 0.45}s` }}
                  />
                  <span className="relative inline-block h-2 w-2 rounded-full bg-[#E3262E]" />
                </div>
                <p className="text-sm font-semibold">{step.en}</p>
                <p className="text-[11px] text-white/40">{step.ko}</p>
              </div>
              {i < PIPELINE_STEPS.length - 1 && <div className="mx-2 mt-[5px] h-px flex-1 bg-white/10" />}
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-white/10 px-6 py-8 text-center text-xs text-white/30">
        © {new Date().getFullYear()} Fandom Research
      </footer>
    </main>
  );
}
