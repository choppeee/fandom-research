"use client";

import { useEffect, useState } from "react";
import { InstantIntelligencePanel } from "./InstantIntelligencePanel";
import { BroadResearchForm } from "./BroadResearchForm";

type Mode = "single_content" | "broad_research";

const MODES: { mode: Mode; title: string; blurb: string; description: string }[] = [
  {
    mode: "single_content",
    title: "Instant Intelligence",
    blurb: "링크 · 연결 계정 · 업로드 데이터로 바로 분석합니다.",
    description: "링크를 붙여넣거나, 관리 중인 계정을 연결하거나, 보유한 데이터를 업로드해 바로 분석을 시작합니다.",
  },
  {
    mode: "broad_research",
    title: "IP 전체 분석",
    blurb: "여러 콘텐츠에서 반복 패턴을 찾습니다.",
    description: "여러 콘텐츠에서 반복되는 인식과 패턴을 찾습니다.",
  },
];

export function ResearchModeSelector() {
  const [mode, setMode] = useState<Mode | null>(null);

  useEffect(() => {
    const last = localStorage.getItem("lastResearchMode");
    if (last === "single_content" || last === "broad_research") setMode(last);
  }, []);

  return (
    <div className="w-full space-y-8">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {MODES.map((m) => (
          <button
            key={m.mode}
            type="button"
            onClick={() => setMode(m.mode)}
            className={`rounded-lg border p-5 text-left transition-colors ${
              mode === m.mode
                ? "border-brand bg-brand-soft"
                : "border-line bg-surface hover:border-ink-muted"
            }`}
          >
            <p className={`text-sm font-semibold ${mode === m.mode ? "text-brand" : "text-ink"}`}>{m.title}</p>
            <p className="mt-1 text-xs text-ink-secondary">{m.blurb}</p>
          </button>
        ))}
      </div>

      {mode ? (
        <div className="mx-auto max-w-lg">
          <p className="mb-5 text-sm text-ink-secondary">{MODES.find((m) => m.mode === mode)?.description}</p>
          {mode === "single_content" ? <InstantIntelligencePanel /> : <BroadResearchForm />}
        </div>
      ) : (
        <p className="text-center text-sm text-ink-muted">분석 범위를 먼저 선택하세요.</p>
      )}
    </div>
  );
}
