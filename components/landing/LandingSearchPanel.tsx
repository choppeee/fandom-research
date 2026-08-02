"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Tab = "keyword" | "link";

const EXAMPLES: { tab: Tab; label: string }[] = [
  { tab: "link", label: "https://youtu.be/xxxxxxx" },
  { tab: "link", label: "https://youtube.com/@channel" },
  { tab: "keyword", label: "신민아" },
  { tab: "keyword", label: "Nike" },
];

/** 로그아웃 상태에서도 실제로 타이핑은 되지만, 제출하면 로그인으로 보낸다 - 로그인 없이
 * job을 만들 수는 없어서(요금/리소스가 드는 작업), 여기서 가짜로 분석을 시작한 척하지 않는다. */
export function LandingSearchPanel() {
  const [tab, setTab] = useState<Tab>("keyword");
  const [value, setValue] = useState("");
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    router.push("/login");
  }

  function applyExample(ex: { tab: Tab; label: string }) {
    setTab(ex.tab);
    setValue(ex.label);
  }

  return (
    <div className="grid gap-8 rounded-2xl border border-white/10 bg-[#17181B] p-6 sm:p-8 lg:grid-cols-[1.5fr_1fr] lg:gap-10">
      <div>
        <p className="text-sm font-semibold text-white">새로운 Decision을 준비하세요.</p>

        <div className="mt-5 flex items-center gap-6 border-b border-white/10 text-sm">
          <button
            type="button"
            onClick={() => setTab("keyword")}
            className={`relative pb-3 font-medium transition-colors ${
              tab === "keyword" ? "text-white" : "text-white/40 hover:text-white/70"
            }`}
          >
            키워드 리서치
            {tab === "keyword" && <span className="absolute -bottom-px left-0 right-0 h-[2px] bg-[#E3262E]" />}
          </button>
          <button
            type="button"
            onClick={() => setTab("link")}
            className={`relative pb-3 font-medium transition-colors ${
              tab === "link" ? "text-white" : "text-white/40 hover:text-white/70"
            }`}
          >
            링크 하나 분석
            {tab === "link" && <span className="absolute -bottom-px left-0 right-0 h-[2px] bg-[#E3262E]" />}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3 sm:flex-row">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={tab === "keyword" ? "키워드 또는 주제를 입력하세요" : "YouTube 영상·채널·재생목록 링크를 붙여넣으세요"}
            className="flex-1 rounded-lg border border-white/10 bg-[#0F1012] px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-[#E3262E] focus:outline-none"
          />
          <button
            type="submit"
            className="shrink-0 rounded-lg bg-[#E3262E] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#c81f26]"
          >
            {tab === "keyword" ? "리서치 시작" : "URL 분석하기"}
          </button>
        </form>
        <p className="mt-3 text-xs text-white/30">
          예) 신민아, 에스파, 박우진, Nike, 올리브영, 다이어트 보조제
        </p>
      </div>

      <div>
        <p className="mb-3 text-xs font-semibold tracking-wide text-white/40">예시로 시작해보세요</p>
        <div className="flex flex-col gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex.label}
              type="button"
              onClick={() => applyExample(ex)}
              className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#0F1012] px-3 py-2.5 text-left text-sm text-white/70 transition-colors hover:border-[#E3262E]/50 hover:text-white"
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-sm bg-[#E3262E]" />
              <span className="truncate">{ex.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
