"use client";

import { useState } from "react";

export function ExpandableAnalysis({ label = "근거와 판단 과정 보기", children }: { label?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs font-medium text-brand hover:text-brand-hover"
      >
        {open ? "접기" : label}
      </button>
      {open && <div className="mt-2 space-y-1.5 border-l-2 border-line pl-3 text-sm text-ink-secondary">{children}</div>}
    </div>
  );
}
