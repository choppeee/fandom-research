"use client";

import { useEffect, useState } from "react";

/** 섹션 id 목록을 감시해 지금 화면에 보이는 섹션을 추적한다(Sticky Rail의 scrollspy). */
export function useReportNavigation(sectionIds: string[]) {
  const [activeId, setActiveId] = useState<string | null>(sectionIds[0] ?? null);

  useEffect(() => {
    if (sectionIds.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-15% 0px -70% 0px", threshold: 0 }
    );
    const els = sectionIds.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => Boolean(el));
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [sectionIds]);

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return { activeId, scrollTo };
}
