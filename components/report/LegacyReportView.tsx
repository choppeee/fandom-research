"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ReportModel } from "@/lib/report/reportSchema";
import { ExpandableAnalysis } from "./ExpandableAnalysis";

/** 구버전(자유 마크다운) job을 위한 대체 화면. 원문 전체를 첫 화면에 펼치지 않고 섹션별로
 * 나눠 기본은 접어두며, 매핑 안 된 원문(rawFallback)은 "전체 분석 보기"에서만 접근한다. */
export function LegacyReportView({ legacy }: { legacy: NonNullable<ReportModel["legacy"]> }) {
  return (
    <div className="space-y-4">
      <div className="rounded-md border border-line bg-surface-soft p-3 text-xs text-ink-muted">
        이 리포트는 이전 버전 파이프라인으로 생성되어 구조화 표시를 지원하지 않습니다. 최신 형식으로 보려면
        같은 키워드로 다시 분석해 주세요.
      </div>
      {legacy.blocks.map((block) => (
        <div key={block.moduleKey} className="rounded-xl border border-line p-5">
          <h3 className="mb-2 text-base font-bold text-ink">{block.title}</h3>
          <ExpandableAnalysis label="전체 분석 보기">
            <div className="ip-report">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{block.markdown}</ReactMarkdown>
            </div>
          </ExpandableAnalysis>
        </div>
      ))}
    </div>
  );
}
