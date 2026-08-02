"use client";

import { useState } from "react";
import { LinkPasteTab } from "./LinkPasteTab";
import { AccountConnectTab } from "./AccountConnectTab";
import { DataUploadTab } from "./DataUploadTab";

type EntryTab = "link" | "connect" | "upload";

const TABS: { key: EntryTab; label: string }[] = [
  { key: "link", label: "링크 붙여넣기" },
  { key: "connect", label: "계정 연결" },
  { key: "upload", label: "데이터 업로드" },
];

export function InstantIntelligencePanel() {
  const [tab, setTab] = useState<EntryTab>("link");

  return (
    <div className="space-y-5">
      <div className="flex gap-1 rounded-lg border border-line bg-surface-soft p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-md px-3 py-2 text-xs font-medium transition-colors ${
              tab === t.key ? "bg-brand text-white" : "text-ink-secondary hover:bg-surface"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "link" && <LinkPasteTab />}
      {tab === "connect" && <AccountConnectTab />}
      {tab === "upload" && <DataUploadTab />}
    </div>
  );
}
