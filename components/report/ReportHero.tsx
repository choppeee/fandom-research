import type { ReportModel } from "@/lib/report/reportSchema";

const REPORT_MODE_LABEL: Record<string, string> = {
  exploratory: "Exploratory",
  standard: "Standard",
  deep: "Deep",
};

export function ReportHero({ meta, onDownloadPdf, downloadHref }: { meta: ReportModel["meta"]; onDownloadPdf?: () => void; downloadHref: string }) {
  return (
    <div className="border-b border-line pb-6">
      <div className="mb-3 text-[11px] font-semibold tracking-widest text-ink-muted">AUDIENCE &amp; IP INTELLIGENCE REPORT</div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold leading-tight text-ink sm:text-4xl">{meta.keyword}</h1>
          <p className="mt-1.5 text-sm text-ink-secondary">
            {meta.ipType.typeLabel} · {meta.ipType.audienceTerm} 반응 분석
          </p>
        </div>
        <a
          href={downloadHref}
          onClick={onDownloadPdf}
          className="shrink-0 rounded-md bg-brand px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-hover"
        >
          PDF 다운로드
        </a>
      </div>
      <dl className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-xs text-ink-muted">
        <div className="flex gap-1.5">
          <dt>분석 기간</dt>
          <dd className="text-ink-secondary">
            {meta.periodStart} ~ {meta.periodEnd}
          </dd>
        </div>
        <div className="flex gap-1.5">
          <dt>수집 Signal</dt>
          <dd className="text-ink-secondary">{(meta.commentCount + meta.postCount).toLocaleString("ko-KR")}건</dd>
        </div>
        <div className="flex gap-1.5">
          <dt>분석 콘텐츠</dt>
          <dd className="text-ink-secondary">{meta.videoCount}개</dd>
        </div>
        <div className="flex gap-1.5">
          <dt>Report Mode</dt>
          <dd className="text-ink-secondary">{REPORT_MODE_LABEL[meta.reportMode] ?? meta.reportMode}</dd>
        </div>
        {meta.generatedAt && (
          <div className="flex gap-1.5">
            <dt>생성일</dt>
            <dd className="text-ink-secondary">{meta.generatedAt.slice(0, 10)}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}
