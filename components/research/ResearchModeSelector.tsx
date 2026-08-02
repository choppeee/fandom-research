"use client";

import { useEffect, useState } from "react";
import { SingleLinkForm } from "./SingleLinkForm";
import { BroadResearchForm } from "./BroadResearchForm";

type Mode = "single_content" | "broad_research";

const MODES: { mode: Mode; title: string; blurb: string; description: string }[] = [
  {
    mode: "single_content",
    title: "단일 링크 분석",
    blurb: "한 개 콘텐츠를 깊게 읽습니다.",
    description: "특정 콘텐츠 한 편에서 사람들이 무엇에 반응했는지 깊게 읽습니다.",
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
          {mode === "single_content" ? <SingleLinkForm /> : <BroadResearchForm />}
        </div>
      ) : (
        <p className="text-center text-sm text-ink-muted">분석 범위를 먼저 선택하세요.</p>
      )}
    </div>
  );
}
