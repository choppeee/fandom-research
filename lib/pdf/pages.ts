import { COLORS, GRAY, PAGE, confidenceLabel } from "./tokens";
import { confidenceMeter, keywordConstellation } from "./charts";
import type { StructuredInsight, DecisionType, PossibleBottleneck } from "../insight-types";

function esc(s: string): string {
  const plain = String(s ?? "").replace(/\*/g, "");
  return plain.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function baseStyles(accent: string): string {
  return `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: ${GRAY[100]}; }
  body { font-family: 'NanumGothic', sans-serif; color: ${COLORS.text}; font-size: 13px; line-height: 1.6; }
  .page { width: ${PAGE.width}px; height: ${PAGE.height}px; position: relative; background: ${COLORS.surface}; overflow: hidden; page-break-after: always; }
  .page:last-child { page-break-after: auto; }
  .accent { color: ${accent}; }
  .bg-accent { background: ${accent}; }
  h1, h2, h3, h4 { font-weight: 700; letter-spacing: -0.01em; }
  p { margin: 0 0 8px; color: ${GRAY[700]}; }
  ul { margin: 0 0 8px 18px; color: ${GRAY[700]}; }
  li { margin-bottom: 4px; }
  strong { color: ${COLORS.text}; font-weight: 700; }
  .header { position: absolute; top: 30px; left: ${PAGE.margin}px; right: ${PAGE.margin}px; display: flex; justify-content: space-between; align-items: center; }
  .header .dash { width: 36px; height: 2px; background: ${GRAY[300]}; }
  .header .brand { font-size: 11px; font-weight: 700; color: ${GRAY[500]}; letter-spacing: 0.4px; }
  .footer { position: absolute; bottom: 22px; left: ${PAGE.margin}px; right: ${PAGE.margin}px; display: flex; justify-content: space-between; font-size: 9px; color: ${GRAY[400]}; }
  .chart-empty { color: ${GRAY[400]}; font-size: 11px; padding: 20px 0; }
  .badge { display: inline-block; padding: 3px 9px; border-radius: 999px; font-size: 9.5px; font-weight: 700; letter-spacing: 0.3px; }
  .badge-risk { background: ${COLORS.riskTint}; color: ${COLORS.risk}; }
  .badge-warning { background: ${COLORS.warningTint}; color: ${COLORS.warning}; }
  .badge-positive { background: ${COLORS.positiveTint}; color: ${COLORS.positive}; }
  .badge-accent { background: ${accent}1A; color: ${accent}; }
  .quote-card { background: ${GRAY[50]}; border-left: 3px solid ${accent}; border-radius: 6px; padding: 12px 16px; font-size: 12px; color: ${GRAY[800]}; font-style: italic; }
  .quote-source { font-size: 9.5px; color: ${GRAY[500]}; margin-top: 6px; font-style: normal; }
  .what-this-means { font-size: 11px; color: ${GRAY[600]}; background: ${GRAY[50]}; border-radius: 6px; padding: 8px 12px; margin-top: 10px; }
  .what-this-means strong { color: ${GRAY[700]}; }
  `;
}

export function header(breadcrumb: string): string {
  return `<div class="header"><div style="display:flex;align-items:center;gap:12px;"><div class="dash"></div><span style="font-size:10.5px;color:${GRAY[500]};">${esc(breadcrumb)}</span></div><span class="brand">FANDOM RESEARCH</span></div>`;
}

export function footer(reportTitle: string, pageNum: number): string {
  return `<div class="footer"><span>${esc(reportTitle)}</span><span>${pageNum}</span></div>`;
}

/** 챕터 전환을 별도 페이지 대신 해당 챕터 첫 페이지 상단에 넣는 슬림 배너. */
export function chapterBanner(params: { num: string; title: string; keyQuestion: string; accent: string }): string {
  return `<div style="margin-top:58px;margin-bottom:6px;display:flex;align-items:baseline;gap:14px;">
    <span style="font-size:13px;font-weight:700;color:${params.accent};letter-spacing:0.5px;">${esc(params.num)} ${esc(params.title)}</span>
    <span style="font-size:11px;color:${GRAY[500]};">${esc(params.keyQuestion)}</span>
  </div>`;
}

export function whatThisMeans(text: string): string {
  return `<div class="what-this-means"><strong>WHAT THIS MEANS —</strong> ${esc(text)}</div>`;
}

function confidenceBadge(level: string, accent: string): string {
  const color = level === "HIGH" ? COLORS.positive : level === "LOW" ? GRAY[500] : accent;
  return `<span class="badge" style="background:${color}1A;color:${color};">${esc(confidenceLabel(level))}</span>`;
}

const DECISION_LABEL_KO: Record<string, string> = {
  KEEP: "유지",
  REPEAT: "반복",
  AMPLIFY: "확대",
  CLARIFY: "명확화",
  TEST: "테스트",
  EXPAND: "확장",
  CONNECT: "연결",
  PROTECT: "보호",
  REFRAME: "재정의",
  CORRECT: "교정",
  WATCH: "관찰",
  AVOID: "보류",
  NO_CHANGE: "현행 유지",
};
const DECISION_TIER_COLOR: Record<string, "positive" | "accent" | "gray" | "risk"> = {
  KEEP: "positive",
  REPEAT: "positive",
  AMPLIFY: "positive",
  PROTECT: "positive",
  CLARIFY: "positive",
  CORRECT: "positive",
  CONNECT: "positive",
  TEST: "accent",
  EXPAND: "accent",
  REFRAME: "accent",
  WATCH: "gray",
  NO_CHANGE: "gray",
  AVOID: "risk",
};

function decisionBadge(decision: DecisionType | undefined, accent: string): string {
  if (!decision) return "";
  const tier = DECISION_TIER_COLOR[decision] ?? "gray";
  const color = tier === "positive" ? COLORS.positive : tier === "accent" ? accent : tier === "risk" ? COLORS.risk : GRAY[500];
  return `<span class="badge" style="background:${color}1A;color:${color};">${esc(DECISION_LABEL_KO[decision] ?? decision)}</span>`;
}

function bottleneckNote(b: PossibleBottleneck | undefined): string {
  if (!b) return "";
  return `<div style="font-size:9.5px;color:${COLORS.warning};margin-top:8px;background:${COLORS.warningTint};border-radius:6px;padding:6px 8px;">병목 후보: ${esc(b.type)} — ${esc(b.evidence)}</div>`;
}

// ---------------------------------------------------------------------------
// A. Cover (데이터 기반 그래픽: keyword constellation)
// ---------------------------------------------------------------------------
export function coverPage(params: {
  keyword: string;
  periodStart: string;
  periodEnd: string;
  videoCount: number;
  commentCount: number;
  postCount: number;
  generatedAt: string;
  topKeywords: { keyword: string; count: number }[];
  accent: string;
}): string {
  const { keyword, periodStart, periodEnd, videoCount, commentCount, postCount, generatedAt, topKeywords, accent } = params;
  const graphic = keywordConstellation(topKeywords, { width: 480, height: 480, accent });
  return `<section class="page" style="display:flex;">
    <div style="width:420px;background:${COLORS.panelTint};padding:56px 40px;display:flex;flex-direction:column;justify-content:center;border-right:1px solid ${COLORS.border};">
      <div class="dash" style="margin-bottom:20px;"></div>
      <div style="font-size:11px;color:${GRAY[500]};margin-bottom:10px;letter-spacing:0.3px;">Audience &amp; IP Intelligence Report</div>
      <h1 style="font-size:32px;line-height:1.3;color:${COLORS.text};margin-bottom:24px;">${esc(keyword)}</h1>
      <div style="font-size:11px;color:${GRAY[600]};line-height:2;">
        <div>분석 기간 &nbsp;${esc(periodStart)} ~ ${esc(periodEnd)}</div>
        <div>데이터 &nbsp;영상 ${videoCount} · 댓글 ${commentCount}${postCount ? ` · X 게시물 ${postCount}` : ""}</div>
        <div>플랫폼 &nbsp;YouTube${postCount ? " · X" : ""}</div>
        <div>생성일 &nbsp;${esc(generatedAt)}</div>
      </div>
    </div>
    <div style="flex:1;position:relative;display:flex;align-items:center;justify-content:center;">
      ${graphic}
      <div style="position:absolute;bottom:40px;left:40px;font-size:9.5px;color:${GRAY[400]};">실제 상위 언급 키워드 기반 그래픽</div>
    </div>
  </section>`;
}

// ---------------------------------------------------------------------------
// C. KPI Dashboard
// ---------------------------------------------------------------------------
export function kpiDashboardPage(params: {
  breadcrumb: string;
  reportTitle: string;
  pageNum: number;
  kpis: { label: string; value: string; sub?: string }[];
  disclaimer?: string;
  accent: string;
}): string {
  const cards = params.kpis
    .map(
      (k) => `<div style="flex:1;min-width:150px;background:${GRAY[50]};border-radius:10px;padding:18px 20px;">
      <div style="font-size:9.5px;color:${GRAY[500]};letter-spacing:0.5px;margin-bottom:8px;">${esc(k.label)}</div>
      <div style="font-size:24px;font-weight:700;color:${COLORS.text};">${esc(k.value)}</div>
      ${k.sub ? `<div style="font-size:10px;color:${GRAY[500]};margin-top:4px;">${esc(k.sub)}</div>` : ""}
    </div>`
    )
    .join("");

  return `<section class="page" style="padding:${PAGE.margin}px;">
    ${header(params.breadcrumb)}
    <h2 style="font-size:24px;margin-top:70px;margin-bottom:6px;">KEY METRICS AT A GLANCE</h2>
    <div style="font-size:12px;color:${GRAY[500]};margin-bottom:${params.disclaimer ? "16" : "32"}px;">이번 리서치에서 실제로 계산된 핵심 지표입니다.</div>
    ${
      params.disclaimer
        ? `<div style="background:${COLORS.warningTint};border-left:3px solid ${COLORS.warning};border-radius:6px;padding:10px 14px;margin-bottom:20px;font-size:11px;color:${GRAY[800]};">${esc(params.disclaimer)}</div>`
        : ""
    }
    <div style="display:flex;flex-wrap:wrap;gap:16px;">${cards}</div>
    ${footer(params.reportTitle, params.pageNum)}
  </section>`;
}

// ---------------------------------------------------------------------------
// D. Executive Summary - Top 5 Findings
// ---------------------------------------------------------------------------
export function execSummaryCardsPage(params: {
  breadcrumb: string;
  reportTitle: string;
  pageNum: number;
  findings: { headline: string; evidence: string; implication: string }[];
  accent: string;
}): string {
  const cards = params.findings
    .map(
      (ins, i) => `<div style="border:1px solid ${GRAY[200]};border-radius:10px;padding:14px 18px;margin-bottom:10px;">
      <div style="display:flex;gap:14px;">
        <div style="font-size:19px;font-weight:700;color:${params.accent};width:32px;flex-shrink:0;">${String(i + 1).padStart(2, "0")}</div>
        <div style="flex:1;">
          <div style="font-size:13px;font-weight:700;color:${COLORS.text};margin-bottom:5px;line-height:1.4;">${esc(ins.headline)}</div>
          <div style="font-size:10.5px;color:${GRAY[500]};margin-bottom:3px;line-height:1.4;"><strong style="color:${GRAY[600]};">Evidence</strong> ${esc(ins.evidence)}</div>
          <div style="font-size:10.5px;color:${GRAY[600]};line-height:1.4;"><strong style="color:${GRAY[600]};">Implication</strong> ${esc(ins.implication)}</div>
        </div>
      </div>
    </div>`
    )
    .join("");

  return `<section class="page" style="padding:${PAGE.margin}px;">
    ${header(params.breadcrumb)}
    <h2 style="font-size:22px;margin-top:70px;margin-bottom:4px;">TOP 5 STRATEGIC FINDINGS</h2>
    <div style="font-size:11px;color:${GRAY[500]};margin-bottom:18px;">이 페이지만 읽어도 리포트 핵심을 파악할 수 있습니다.</div>
    <div>${cards}</div>
    ${footer(params.reportTitle, params.pageNum)}
  </section>`;
}

// ---------------------------------------------------------------------------
// E. IP at a Glance (flow diagram) + Final Sentence
// ---------------------------------------------------------------------------
export function ipAtGlancePage(params: {
  breadcrumb: string;
  reportTitle: string;
  pageNum: number;
  steps: { label: string; value: string }[];
  finalSentence: string;
  accent: string;
}): string {
  const rows = params.steps
    .map(
      (s, i) => `
      <div style="display:flex;align-items:flex-start;gap:16px;">
        <div style="width:130px;flex-shrink:0;text-align:right;font-size:10px;font-weight:700;letter-spacing:0.4px;color:${params.accent};padding-top:4px;">${esc(s.label)}</div>
        <div style="flex:1;background:${GRAY[50]};border-radius:8px;padding:11px 16px;font-size:12px;color:${GRAY[800]};">${esc(s.value)}</div>
      </div>
      ${i < params.steps.length - 1 ? `<div style="margin-left:138px;color:${GRAY[300]};font-size:13px;">↓</div>` : ""}
    `
    )
    .join("");

  return `<section class="page" style="padding:${PAGE.margin}px;">
    ${header(params.breadcrumb)}
    <h2 style="font-size:22px;margin-top:70px;margin-bottom:18px;">IP AT A GLANCE</h2>
    <div>${rows}</div>
    ${
      params.finalSentence
        ? `<div style="position:absolute;left:${PAGE.margin}px;right:${PAGE.margin}px;bottom:70px;background:${params.accent}12;border-left:3px solid ${params.accent};border-radius:8px;padding:14px 20px;">
            <div style="font-size:9px;font-weight:700;color:${params.accent};letter-spacing:0.5px;margin-bottom:4px;">FINAL STRATEGIC CONCLUSION</div>
            <div style="font-size:14px;font-weight:700;color:${COLORS.text};">${esc(params.finalSentence)}</div>
          </div>`
        : ""
    }
    ${footer(params.reportTitle, params.pageNum)}
  </section>`;
}

// ---------------------------------------------------------------------------
// F. Insight Module Page (핵심 템플릿) — headline + 60/40 split + evidence card + strategic implication banner
// ---------------------------------------------------------------------------
export function insightModulePage(params: {
  breadcrumb: string;
  reportTitle: string;
  pageNum: number;
  chapterIntro?: { num: string; title: string; keyQuestion: string };
  moduleTitle: string;
  applicable: boolean;
  notApplicableReason?: string;
  primary?: StructuredInsight;
  secondary?: StructuredInsight[];
  chartHtml?: string;
  accent: string;
}): string {
  const topOffset = params.chapterIntro ? 106 : 68;
  const bannerHtml = params.chapterIntro ? chapterBanner({ ...params.chapterIntro, accent: params.accent }) : "";

  if (!params.applicable || !params.primary) {
    return `<section class="page" style="padding:${PAGE.margin}px;">
      ${header(params.breadcrumb)}
      ${bannerHtml}
      <div style="margin-top:${params.chapterIntro ? 8 : 40}px;">
        <div style="font-size:11px;font-weight:700;color:${GRAY[500]};margin-bottom:10px;">${esc(params.moduleTitle)}</div>
        <div class="chart-empty">${esc(params.notApplicableReason || "이번 데이터/IP 유형에는 적용하기 어렵습니다.")}</div>
      </div>
      ${footer(params.reportTitle, params.pageNum)}
    </section>`;
  }

  const p = params.primary;
  const evidenceItems = p.evidence
    .map((e) => `<div style="font-size:10.5px;color:${GRAY[700]};padding:7px 0;border-bottom:1px solid ${GRAY[100]};">${esc(e)}</div>`)
    .join("");

  const secondaryHtml = (params.secondary ?? [])
    .slice(0, 2)
    .map(
      (s) => `<div style="display:flex;gap:10px;align-items:flex-start;padding:9px 0;border-top:1px solid ${GRAY[100]};">
      <div style="flex-shrink:0;margin-top:2px;display:flex;gap:4px;">${confidenceBadge(s.confidence, params.accent)}${decisionBadge(s.decision, params.accent)}</div>
      <div style="flex:1;">
        <div style="font-size:11.5px;font-weight:700;color:${COLORS.text};margin-bottom:2px;">${esc(s.headline)}</div>
        <div style="font-size:10px;color:${GRAY[500]};line-height:1.5;">${esc(s.strategicImplication)}</div>
      </div>
    </div>`
    )
    .join("");

  return `<section class="page" style="padding:${PAGE.margin}px;">
    ${header(params.breadcrumb)}
    ${bannerHtml}
    <div style="margin-top:${params.chapterIntro ? 10 : 40}px;">
      <div style="font-size:10px;font-weight:700;color:${GRAY[500]};letter-spacing:0.5px;margin-bottom:8px;">${esc(params.moduleTitle.toUpperCase())}</div>
      <h2 style="font-size:20px;line-height:1.4;margin-bottom:16px;max-width:1080px;">${esc(p.headline)}</h2>
      <div style="display:flex;gap:28px;">
        <div style="flex:1;max-width:${params.chartHtml ? "640" : "700"}px;font-size:12.5px;color:${GRAY[700]};line-height:1.65;">
          ${esc(p.interpretation)}
        </div>
        <div style="width:${params.chartHtml ? "260" : "300"}px;flex-shrink:0;">
          <div style="background:${GRAY[50]};border-radius:8px;padding:12px 16px;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;gap:6px;flex-wrap:wrap;">
              <span style="font-size:9px;font-weight:700;color:${GRAY[500]};letter-spacing:0.4px;">EVIDENCE</span>
              <div style="display:flex;gap:4px;">${confidenceBadge(p.confidence, params.accent)}${decisionBadge(p.decision, params.accent)}</div>
            </div>
            ${evidenceItems}
            <div style="font-size:9px;color:${GRAY[400]};margin-top:6px;">${esc(p.evidenceScope)}</div>
            ${p.theory ? `<div style="font-size:9.5px;color:${GRAY[400]};margin-top:8px;">이론: ${esc(p.theory)}</div>` : ""}
            ${bottleneckNote(p.possibleBottleneck)}
          </div>
        </div>
        ${params.chartHtml ? `<div style="flex-shrink:0;">${params.chartHtml}</div>` : ""}
      </div>
      ${secondaryHtml ? `<div style="margin-top:6px;">${secondaryHtml}</div>` : ""}
    </div>
    <div style="position:absolute;left:${PAGE.margin}px;right:${PAGE.margin}px;bottom:56px;background:${params.accent}0F;border-left:3px solid ${params.accent};border-radius:8px;padding:11px 18px;">
      <div style="font-size:9px;font-weight:700;color:${params.accent};letter-spacing:0.4px;margin-bottom:3px;">STRATEGIC IMPLICATION</div>
      <div style="font-size:11.5px;color:${GRAY[800]};">${esc(p.whyItMatters)} ${esc(p.strategicImplication)}</div>
    </div>
    ${footer(params.reportTitle, params.pageNum)}
  </section>`;
}

// ---------------------------------------------------------------------------
// G. IP Diagnostic Dashboard
// ---------------------------------------------------------------------------
export function diagnosticDashboardPage(params: {
  breadcrumb: string;
  reportTitle: string;
  pageNum: number;
  chapterIntro?: { num: string; title: string; keyQuestion: string };
  strong: { label: string; evidence: string }[];
  hidden: { label: string; evidence: string }[];
  weak: { label: string; evidence: string }[];
  risks: { label: string; evidence: string }[];
  accent: string;
}): string {
  const col = (title: string, items: { label: string; evidence: string }[], color: string) => `
    <div style="flex:1;">
      <div style="font-size:11px;font-weight:700;color:${color};letter-spacing:0.4px;margin-bottom:10px;">${title}</div>
      ${
        items.length === 0
          ? `<div class="chart-empty">데이터 부족</div>`
          : items
              .slice(0, 3)
              .map(
                (it) => `<div style="background:${GRAY[50]};border-radius:8px;padding:10px 12px;margin-bottom:8px;">
                <div style="font-size:11.5px;font-weight:700;color:${COLORS.text};margin-bottom:3px;">${esc(it.label)}</div>
                <div style="font-size:9.5px;color:${GRAY[500]};">${esc(it.evidence)}</div>
              </div>`
              )
              .join("")
      }
    </div>`;

  const bannerHtml = params.chapterIntro ? chapterBanner({ ...params.chapterIntro, accent: params.accent }) : "";

  return `<section class="page" style="padding:${PAGE.margin}px;">
    ${header(params.breadcrumb)}
    ${bannerHtml}
    <h2 style="font-size:22px;margin-top:${params.chapterIntro ? 10 : 64}px;margin-bottom:20px;">IP DIAGNOSTIC DASHBOARD</h2>
    <div style="display:flex;gap:20px;">
      ${col("STRONG ASSETS", params.strong, COLORS.positive)}
      ${col("HIDDEN ASSETS", params.hidden, params.accent)}
      ${col("WEAK SIGNALS", params.weak, COLORS.warning)}
      ${col("RISKS", params.risks, COLORS.risk)}
    </div>
    ${footer(params.reportTitle, params.pageNum)}
  </section>`;
}

// ---------------------------------------------------------------------------
// H. Audience Funnel
// ---------------------------------------------------------------------------
export function audienceFunnelPage(params: {
  breadcrumb: string;
  reportTitle: string;
  pageNum: number;
  funnelSvg: string;
  stages: { stage: string; trigger: string | null; dropoff: string | null }[];
  accent: string;
}): string {
  const details = params.stages
    .map(
      (s) => `<div style="flex:1;min-width:150px;">
      <div style="font-size:10px;font-weight:700;color:${params.accent};margin-bottom:6px;">${esc(s.stage)}</div>
      <div style="font-size:10px;color:${GRAY[600]};margin-bottom:4px;"><strong>Trigger</strong> ${esc(s.trigger ?? "데이터 부족")}</div>
      <div style="font-size:10px;color:${GRAY[500]};"><strong>Drop-off</strong> ${esc(s.dropoff ?? "-")}</div>
    </div>`
    )
    .join("");

  return `<section class="page" style="padding:${PAGE.margin}px;">
    ${header(params.breadcrumb)}
    <h2 style="font-size:22px;margin-top:64px;margin-bottom:24px;">AUDIENCE FUNNEL</h2>
    <div style="margin-bottom:28px;">${params.funnelSvg}</div>
    <div style="display:flex;gap:16px;flex-wrap:wrap;">${details}</div>
    ${footer(params.reportTitle, params.pageNum)}
  </section>`;
}

// ---------------------------------------------------------------------------
// I. Character Architecture
// ---------------------------------------------------------------------------
export function characterArchitecturePage(params: {
  breadcrumb: string;
  reportTitle: string;
  pageNum: number;
  ipLabel: string;
  layers: { layer: string; label: string; evidence: string }[];
  accent: string;
}): string {
  if (params.layers.length === 0) {
    return `<section class="page" style="padding:${PAGE.margin}px;">
      ${header(params.breadcrumb)}
      <h2 style="font-size:22px;margin-top:64px;margin-bottom:20px;">CHARACTER ARCHITECTURE</h2>
      <div class="chart-empty">이 ${esc(params.ipLabel)}은(는) 캐릭터 구조 분석에 필요한 데이터 근거가 부족합니다.</div>
      ${footer(params.reportTitle, params.pageNum)}
    </section>`;
  }
  const rows = params.layers
    .map(
      (l, i) => `<div style="display:flex;gap:20px;margin-bottom:14px;">
      <div style="width:120px;flex-shrink:0;">
        <div style="font-size:10px;font-weight:700;color:${params.accent};">${esc(l.layer)}</div>
        <div style="width:2px;height:${i < params.layers.length - 1 ? "34" : "0"}px;background:${GRAY[200]};margin:8px auto 0;"></div>
      </div>
      <div style="flex:1;background:${GRAY[50]};border-radius:8px;padding:11px 16px;">
        <div style="font-size:13px;font-weight:700;color:${COLORS.text};margin-bottom:4px;">${esc(l.label)}</div>
        <div style="font-size:10.5px;color:${GRAY[500]};">${esc(l.evidence)}</div>
      </div>
    </div>`
    )
    .join("");

  return `<section class="page" style="padding:${PAGE.margin}px;">
    ${header(params.breadcrumb)}
    <h2 style="font-size:22px;margin-top:64px;margin-bottom:4px;">CHARACTER ARCHITECTURE</h2>
    <div style="font-size:11px;color:${GRAY[500]};margin-bottom:20px;">${esc(params.ipLabel)}의 캐릭터를 4개 레이어로 분해</div>
    <div>${rows}</div>
    ${footer(params.reportTitle, params.pageNum)}
  </section>`;
}

// ---------------------------------------------------------------------------
// J. Opportunity Matrix (2x2, 사분면 + 번호 버블 + 사이드 리스트)
// ---------------------------------------------------------------------------
export function opportunityMatrixPage(params: {
  breadcrumb: string;
  reportTitle: string;
  pageNum: number;
  matrixSvg: string;
  notes: { label: string; note: string }[];
  accent: string;
}): string {
  const list = params.notes
    .slice(0, 6)
    .map(
      (n, i) => `<div style="display:flex;gap:8px;margin-bottom:9px;">
        <div style="width:18px;height:18px;flex-shrink:0;border-radius:50%;background:${params.accent};color:white;font-size:9.5px;font-weight:700;display:flex;align-items:center;justify-content:center;">${i + 1}</div>
        <div style="font-size:10.5px;"><strong>${esc(n.label)}</strong> — <span style="color:${GRAY[500]};">${esc(n.note)}</span></div>
      </div>`
    )
    .join("");

  return `<section class="page" style="padding:${PAGE.margin}px;">
    ${header(params.breadcrumb)}
    <h2 style="font-size:22px;margin-top:64px;margin-bottom:6px;">OPPORTUNITY MATRIX</h2>
    <div style="font-size:11px;color:${GRAY[500]};margin-bottom:16px;">X축: 대중 확장 잠재력 · Y축: 근거 강도 (번호는 오른쪽 목록과 매칭)</div>
    <div style="display:flex;gap:28px;">
      <div>${params.matrixSvg}</div>
      <div style="flex:1;padding-top:8px;">${list || `<div class="chart-empty">데이터 부족</div>`}</div>
    </div>
    ${footer(params.reportTitle, params.pageNum)}
  </section>`;
}

// ---------------------------------------------------------------------------
// K. Perception Map
// ---------------------------------------------------------------------------
export function perceptionMapPage(params: {
  breadcrumb: string;
  reportTitle: string;
  pageNum: number;
  chapterIntro?: { num: string; title: string; keyQuestion: string };
  axisSvg: string;
  accent: string;
}): string {
  const bannerHtml = params.chapterIntro ? chapterBanner({ ...params.chapterIntro, accent: params.accent }) : "";
  return `<section class="page" style="padding:${PAGE.margin}px;">
    ${header(params.breadcrumb)}
    ${bannerHtml}
    <h2 style="font-size:22px;margin-top:${params.chapterIntro ? 10 : 64}px;margin-bottom:24px;">PERCEPTION MAP</h2>
    <div>${params.axisSvg}</div>
    ${footer(params.reportTitle, params.pageNum)}
  </section>`;
}

// ---------------------------------------------------------------------------
// L. Opportunity Map (KEEP / DISCOVER / CREATE)
// ---------------------------------------------------------------------------
export function opportunityMapPage(params: {
  breadcrumb: string;
  reportTitle: string;
  pageNum: number;
  keep: { label: string; evidence: string }[];
  discover: { label: string; evidence: string }[];
  create: { label: string; evidence: string }[];
  accent: string;
}): string {
  const col = (title: string, items: { label: string; evidence: string }[], color: string) => `
    <div style="flex:1;">
      <div style="text-align:center;font-size:11px;font-weight:700;color:white;background:${color};border-radius:6px;padding:6px;margin-bottom:12px;letter-spacing:0.5px;">${title}</div>
      ${
        items.length === 0
          ? `<div class="chart-empty">데이터 부족</div>`
          : items
              .slice(0, 3)
              .map(
                (it) => `<div style="border:1px solid ${GRAY[200]};border-radius:8px;padding:10px 12px;margin-bottom:8px;">
                <div style="font-size:11.5px;font-weight:700;margin-bottom:3px;">${esc(it.label)}</div>
                <div style="font-size:9.5px;color:${GRAY[500]};">${esc(it.evidence)}</div>
              </div>`
              )
              .join("")
      }
    </div>`;

  return `<section class="page" style="padding:${PAGE.margin}px;">
    ${header(params.breadcrumb)}
    <h2 style="font-size:22px;margin-top:64px;margin-bottom:20px;">KEEP / DISCOVER / CREATE</h2>
    <div style="display:flex;gap:18px;">
      ${col("KEEP", params.keep, COLORS.positive)}
      ${col("DISCOVER", params.discover, params.accent)}
      ${col("CREATE", params.create, COLORS.warning)}
    </div>
    ${footer(params.reportTitle, params.pageNum)}
  </section>`;
}

// ---------------------------------------------------------------------------
// M. Positioning Page
// ---------------------------------------------------------------------------
export function positioningPage(params: {
  breadcrumb: string;
  reportTitle: string;
  pageNum: number;
  candidates: { positioning: string; audienceNeed: string; evidence: string; differentiation: string; risk: string }[];
  core: string;
  supporting: string;
  emerging: string;
  accent: string;
}): string {
  const rows = params.candidates
    .slice(0, 4)
    .map(
      (c) => `<div style="border:1px solid ${GRAY[200]};border-radius:8px;padding:10px 14px;margin-bottom:8px;">
      <div style="font-size:12px;font-weight:700;color:${COLORS.text};margin-bottom:4px;">${esc(c.positioning)}</div>
      <div style="font-size:9.5px;color:${GRAY[500]};line-height:1.5;">Need: ${esc(c.audienceNeed)} · 근거: ${esc(c.evidence)} · 차별성: ${esc(c.differentiation)} · 리스크: ${esc(c.risk)}</div>
    </div>`
    )
    .join("");

  const finalBox = (label: string, value: string, color: string) => `
    <div style="flex:1;background:${color}12;border-radius:8px;padding:12px 14px;">
      <div style="font-size:9px;font-weight:700;color:${color};letter-spacing:0.4px;margin-bottom:4px;">${label}</div>
      <div style="font-size:11px;color:${GRAY[800]};line-height:1.5;">${esc(value)}</div>
    </div>`;

  return `<section class="page" style="padding:${PAGE.margin}px;">
    ${header(params.breadcrumb)}
    <h2 style="font-size:22px;margin-top:64px;margin-bottom:4px;">POSITIONING OPTIONS</h2>
    <div style="font-size:11px;color:${GRAY[500]};margin-bottom:16px;">Positioning 후보와 최종 추천 포지션</div>
    <div style="margin-bottom:18px;">${rows || `<div class="chart-empty">데이터 부족</div>`}</div>
    <div style="display:flex;gap:14px;">
      ${finalBox("CORE POSITION", params.core, params.accent)}
      ${finalBox("SUPPORTING POSITION", params.supporting, GRAY[600])}
      ${finalBox("EMERGING POSITION", params.emerging, COLORS.warning)}
    </div>
    ${footer(params.reportTitle, params.pageNum)}
  </section>`;
}

// ---------------------------------------------------------------------------
// N. Strategy Page (13종 Decision을 4개 실행 티어로 묶어 배치)
// ---------------------------------------------------------------------------
const DECISION_LABEL: Record<string, string> = {
  KEEP: "KEEP · 유지",
  REPEAT: "REPEAT · 반복",
  AMPLIFY: "AMPLIFY · 확대",
  CLARIFY: "CLARIFY · 명확화",
  TEST: "TEST · 테스트",
  EXPAND: "EXPAND · 확장",
  CONNECT: "CONNECT · 연결",
  PROTECT: "PROTECT · 보호",
  REFRAME: "REFRAME · 재정의",
  CORRECT: "CORRECT · 교정",
  WATCH: "WATCH · 관찰",
  AVOID: "AVOID · 보류",
  NO_CHANGE: "NO CHANGE · 현행 유지",
};

const DECISION_TIER: Record<string, "act" | "test" | "watch" | "avoid"> = {
  KEEP: "act",
  REPEAT: "act",
  AMPLIFY: "act",
  PROTECT: "act",
  CLARIFY: "act",
  CORRECT: "act",
  CONNECT: "act",
  TEST: "test",
  EXPAND: "test",
  REFRAME: "test",
  WATCH: "watch",
  NO_CHANGE: "watch",
  AVOID: "avoid",
};

const TIER_LABEL: Record<string, string> = {
  act: "지금 실행",
  test: "먼저 검증",
  watch: "관찰",
  avoid: "보류",
};

export function strategyPage(params: {
  breadcrumb: string;
  reportTitle: string;
  pageNum: number;
  recommendations: {
    decision: string;
    title: string;
    insight: string;
    opportunity: string;
    test: string;
    decisionRule: string;
    confidence: string;
  }[];
  appendixIdeas: string[];
  accent: string;
}): string {
  const tierColor = (tier: string) =>
    tier === "act" ? COLORS.positive : tier === "test" ? params.accent : tier === "avoid" ? COLORS.risk : GRAY[500];

  const card = (r: (typeof params.recommendations)[number]) => {
    const tier = DECISION_TIER[r.decision] ?? "watch";
    return `
    <div style="border:1px solid ${GRAY[200]};border-radius:8px;padding:11px 14px;margin-bottom:8px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
        <span style="font-size:9px;font-weight:700;color:white;background:${tierColor(tier)};border-radius:4px;padding:2px 7px;letter-spacing:0.3px;">${esc(DECISION_LABEL[r.decision] ?? r.decision)}</span>
        ${confidenceBadge(r.confidence, params.accent)}
      </div>
      <div style="font-size:12px;font-weight:700;color:${COLORS.text};margin-bottom:5px;">${esc(r.title)}</div>
      <div style="font-size:9.5px;color:${GRAY[600]};line-height:1.55;">
        <p style="margin-bottom:5px;">${esc(r.insight)} ${esc(r.opportunity)}</p>
        <div style="margin-bottom:3px;"><strong style="color:${GRAY[700]};">검증</strong> ${esc(r.test)}</div>
        <div><strong style="color:${GRAY[700]};">중단/확대 기준</strong> ${esc(r.decisionRule)}</div>
      </div>
    </div>`;
  };

  const cols = ["act", "test", "watch", "avoid"].map((tier) => {
    const items = params.recommendations.filter((r) => (DECISION_TIER[r.decision] ?? "watch") === tier);
    if (items.length === 0) return "";
    return `<div style="flex:1;">
      <div style="font-size:9px;font-weight:700;color:${tierColor(tier)};letter-spacing:0.4px;margin-bottom:8px;">${TIER_LABEL[tier]}</div>
      ${items.map(card).join("")}
    </div>`;
  });

  return `<section class="page" style="padding:${PAGE.margin}px;">
    ${header(params.breadcrumb)}
    <h2 style="font-size:22px;margin-top:64px;margin-bottom:4px;">그래서 지금 무엇을 어떻게 움직여야 하는가</h2>
    <div style="font-size:11px;color:${GRAY[500]};margin-bottom:16px;">실제 데이터에 맞는 판단만 선택했다 — 모든 리포트가 같은 조합을 갖지 않는다</div>
    <div style="display:flex;gap:14px;">${cols.join("")}</div>
    ${
      params.appendixIdeas.length > 0
        ? `<div style="position:absolute;left:${PAGE.margin}px;right:${PAGE.margin}px;bottom:56px;">
            <div style="font-size:9px;font-weight:700;color:${GRAY[500]};letter-spacing:0.4px;margin-bottom:4px;">그 외 아이디어 (Appendix)</div>
            <div style="font-size:9.5px;color:${GRAY[500]};">${params.appendixIdeas.slice(0, 6).map(esc).join(" · ")}</div>
          </div>`
        : ""
    }
    ${footer(params.reportTitle, params.pageNum)}
  </section>`;
}

// ---------------------------------------------------------------------------
// O. Reference Cards (ACADEMIC/RESEARCH vs CONTEXT SOURCES 분리)
// ---------------------------------------------------------------------------
export function referencePage(params: {
  breadcrumb: string;
  reportTitle: string;
  pageNum: number;
  academic: { title: string; url: string; note: string }[];
  context: { title: string; url: string; note: string }[];
  accent: string;
}): string {
  const cardsFor = (refs: { title: string; url: string; note: string }[]) =>
    refs
      .slice(0, 2)
      .map(
        (r) => `<div style="width:calc(50% - 8px);border:1px solid ${GRAY[200]};border-radius:10px;padding:14px;">
      <div style="font-size:12px;font-weight:700;color:${COLORS.text};margin-bottom:6px;line-height:1.4;">${esc(r.title)}</div>
      <div style="font-size:9.5px;color:${GRAY[500]};margin-bottom:8px;">${esc(r.note)}</div>
      <div style="font-size:8.5px;color:${GRAY[400]};word-break:break-all;">${esc(r.url)}</div>
    </div>`
      )
      .join("");

  const section = (title: string, refs: { title: string; url: string; note: string }[]) =>
    refs.length === 0
      ? ""
      : `<div style="margin-bottom:18px;">
      <div style="font-size:10px;font-weight:700;color:${params.accent};letter-spacing:0.4px;margin-bottom:10px;">${title}</div>
      <div style="display:flex;flex-wrap:wrap;gap:16px;">${cardsFor(refs)}</div>
    </div>`;

  const hasAny = params.academic.length + params.context.length > 0;

  return `<section class="page" style="padding:${PAGE.margin}px;">
    ${header(params.breadcrumb)}
    <h2 style="font-size:22px;margin-top:64px;margin-bottom:18px;">RESEARCH REFERENCES</h2>
    ${hasAny ? `${section("ACADEMIC / RESEARCH", params.academic)}${section("CONTEXT SOURCES", params.context)}` : `<div class="chart-empty">검증된 외부 자료를 찾지 못했습니다</div>`}
    ${footer(params.reportTitle, params.pageNum)}
  </section>`;
}

// ---------------------------------------------------------------------------
// P. Quote card (레거시 마크다운 폴백 렌더링에서 사용)
// ---------------------------------------------------------------------------
export function quoteCard(text: string, source: string, tag?: string): string {
  return `<div class="quote-card" style="margin-bottom:10px;">
    "${esc(text)}"
    <div class="quote-source">— ${esc(source)} ${tag ? `<span class="badge badge-accent" style="margin-left:6px;">${esc(tag)}</span>` : ""}</div>
  </div>`;
}

/** 레거시(구버전 자유 마크다운) 모듈 콘텐츠를 위한 폴백 텍스트 페이지. */
export function legacyTextPage(params: {
  breadcrumb: string;
  headline: string;
  bodyHtml: string;
  reportTitle: string;
  pageNum: number;
  accent: string;
}): string {
  return `<section class="page" style="padding:${PAGE.margin}px;">
    ${header(params.breadcrumb)}
    <h2 style="font-size:19px;margin-top:64px;margin-bottom:16px;max-width:1080px;line-height:1.4;">${esc(params.headline)}</h2>
    <div style="max-width:1080px;font-size:12px;">${params.bodyHtml}</div>
    ${footer(params.reportTitle, params.pageNum)}
  </section>`;
}

// ---------------------------------------------------------------------------
// Q. Back cover
// ---------------------------------------------------------------------------
export function backCoverPage(params: { accent: string }): string {
  return `<section class="page" style="background:${COLORS.panelTint};display:flex;align-items:center;justify-content:center;">
    <div style="text-align:center;">
      <div style="font-size:11px;color:${GRAY[500]};letter-spacing:1px;margin-bottom:8px;">END OF REPORT</div>
      <div style="font-size:13px;color:${GRAY[600]};">본 리포트는 AI 분석 추정치를 포함하며, 원문 인용은 출처 확인을 위한 소량 예시입니다.</div>
    </div>
  </section>`;
}
