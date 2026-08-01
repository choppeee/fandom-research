"use client";

import { useReportNavigation } from "@/features/research/hooks/useReportNavigation";

export function SectionNav({ items }: { items: { id: string; label: string }[] }) {
  const { activeId, scrollTo } = useReportNavigation(items.map((i) => i.id));
  if (items.length === 0) return null;
  return (
    <nav className="space-y-0.5">
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => scrollTo(item.id)}
          className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
            activeId === item.id ? "font-medium text-ink" : "text-ink-muted hover:text-ink-secondary"
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${activeId === item.id ? "bg-brand" : "bg-line"}`} />
          {item.label}
        </button>
      ))}
    </nav>
  );
}
