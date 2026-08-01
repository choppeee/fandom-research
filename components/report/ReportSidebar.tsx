import type { ReportModel } from "@/lib/report/reportSchema";
import { SectionNav } from "./SectionNav";

const REPORT_MODE_LABEL: Record<string, string> = { exploratory: "Exploratory", standard: "Standard", deep: "Deep" };

/** Sticky Rail은 보조 영역이다 - Section Nav / Report Scope / Primary Export 3개로 제한한다.
 * Data Sample은 본문에 이미 Evidence 섹션이 있으므로 여기서는 중복 노출하지 않는다. */
export function ReportSidebar({
  navItems,
  meta,
  downloadHref,
}: {
  navItems: { id: string; label: string }[];
  meta: ReportModel["meta"];
  downloadHref: string;
}) {
  return (
    <aside className="space-y-6">
      <div>
        <div className="mb-2 text-[10px] font-semibold tracking-wider text-ink-muted">SECTIONS</div>
        <SectionNav items={navItems} />
      </div>

      <div className="border-t border-line pt-4">
        <div className="mb-2 text-[10px] font-semibold tracking-wider text-ink-muted">REPORT SCOPE</div>
        <dl className="space-y-1.5 text-xs">
          <div className="flex justify-between">
            <dt className="text-ink-muted">IP 유형</dt>
            <dd className="text-ink-secondary">{meta.ipType.typeLabel}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-muted">분석 기간</dt>
            <dd className="text-ink-secondary">
              {meta.periodStart}~{meta.periodEnd}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-muted">Report Mode</dt>
            <dd className="text-ink-secondary">{REPORT_MODE_LABEL[meta.reportMode] ?? meta.reportMode}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-muted">데이터 소스</dt>
            <dd className="text-ink-secondary">YouTube{meta.postCount > 0 ? " · X" : ""}</dd>
          </div>
        </dl>
      </div>

      <div className="border-t border-line pt-4">
        <a
          href={downloadHref}
          className="block w-full rounded-md bg-black-surface px-3 py-2 text-center text-xs font-medium text-white hover:bg-ink"
        >
          Intelligence Report PDF
        </a>
      </div>
    </aside>
  );
}
