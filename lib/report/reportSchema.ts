/** 웹 렌더러와 PDF 렌더러가 공유하는 단 하나의 데이터 계약(Canonical Report Schema).
 * 두 렌더러가 서로 다른 판단(웹엔 있는데 PDF엔 "데이터 부족"인 상황 등)을 하지 않도록,
 * "무엇을 보여줄지"에 대한 모든 판단은 이 스키마를 만드는 buildReportModel() 한 곳에서만
 * 내리고, 렌더러는 여기 담긴 것을 그대로 그리기만 한다. */

import type { StructuredInsight, DecisionType, Confidence, StrategyResult } from "../insight-types";
import type { EvidencePackage } from "../evidence-types";
import type { IpTypeInfo } from "../ip-classify";
import type { ReportMode } from "../report-mode";
import type { ValidatedReference } from "../reference-search";
import type { Aggregates } from "../aggregate";

export type ReportMeta = {
  jobId: string;
  keyword: string;
  ipType: IpTypeInfo;
  reportMode: ReportMode;
  researchMode: string; // "single_content" | "broad_research"
  periodStart: string;
  periodEnd: string;
  generatedAt: string | null;
  videoCount: number;
  commentCount: number;
  postCount: number;
};

export type MetricTone = "neutral" | "brand" | "positive" | "warning" | "danger";

/** 실제로 계산 가능한 값만 담는다 - 근거 없는 metric은 buildReportModel 단계에서 아예 만들지 않는다. */
export type MetricItem = {
  key: string;
  label: string;
  value: string;
  caption?: string; // 단위/보조 설명
  tone?: MetricTone;
};

/** 강한 Executive Decision을 만들 조건(현재 상황 판단 가능 + 핵심 질문 존재 + 근거 존재 + 권고 수준 선택 가능)이
 * 안 되면 kind:"exploratory"로 내려가, 화면에서 확정적 톤 대신 완화된 포맷으로 렌더링된다. */
export type ExecutiveDecision =
  | {
      kind: "decision";
      headline: string;
      body: string[];
      currentSituation: string;
      currentPriority: string;
      decision: DecisionType;
      confidence: Confidence;
    }
  | {
      kind: "exploratory";
      headline: string;
      body: string[];
      whatWeKnow: string[];
      whatWeDontKnow: string[];
    };

export type ReportSectionKey = "audience_response" | "intent" | "perception" | "diagnosis" | "decision" | "evidence";

export type CanonicalInsight = StructuredInsight & {
  id: string; // `${moduleKey}-${index}`
  moduleKey: string;
  moduleTitle: string;
  evidencePackage: EvidencePackage;
  // 같은 핵심 근거(영상)를 공유하는 다른 모듈의 발견을 병합했을 때, 병합된 발견의 헤드라인만
  // 짧게 남긴다 - 같은 Evidence를 여러 페이지에 반복해서 보여주지 않기 위함.
  relatedFindings?: string[];
};

export type ReportSection = {
  key: ReportSectionKey;
  title: string;
  insights: CanonicalInsight[];
};

export type ChartSpec =
  | { kind: "trend"; title: string; data: Aggregates["dailyTrend"] }
  | { kind: "keywordBar"; title: string; data: { keyword: string; count: number }[] }
  | { kind: "sentimentDonut"; title: string; data: Aggregates["sentimentRatio"] }
  | { kind: "sentimentTrend"; title: string; data: Aggregates["dailyTrend"] };

/** 구버전(자유 마크다운) job을 위한 대체 표시 - heading 단위로 쪼갠 것만 섹션에 매핑하고,
 * 매핑 안 되는 원문은 rawFallback에만 남겨 첫 화면에 안 나오게 한다. */
export type LegacyBlock = { moduleKey: string; title: string; markdown: string };

export type ReportModel = {
  meta: ReportMeta;
  isLegacy: boolean; // true면 sections/insights 대신 legacy만 신뢰
  executiveDecision: ExecutiveDecision | null;
  metrics: MetricItem[];
  sections: ReportSection[];
  charts: ChartSpec[];
  fandomHighlights: { expression: string; count: number; example: string }[];
  purchaseIntentSummary: { positiveRatio: number; examples: string[] };
  riskAlerts: { level: "caution" | "high_risk"; description: string; exampleCommentId: string | null }[];
  strategy: StrategyResult | null;
  references: ValidatedReference[];
  limitations: string[];
  legacy: { blocks: LegacyBlock[]; rawFallback: string } | null;
};

export const SECTION_LABEL: Record<ReportSectionKey, string> = {
  audience_response: "사람들은 무엇에 반응하는가",
  intent: "사람들이 실제로 원하는 것",
  perception: "인식과 가치",
  diagnosis: "진단",
  decision: "판단",
  evidence: "근거",
};
