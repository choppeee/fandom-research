import { COLORS, GRAY, PAGE, confidenceLabel } from "./tokens";
import { confidenceMeter, keywordConstellation } from "./charts";
import type { StructuredInsight, DecisionType, PossibleBottleneck } from "../insight-types";
import type { CommentEvidence } from "../evidence-types";
import type { PdfEvidencePackage } from "./evidence-types";

function esc(s: string): string {
  const plain = String(s ?? "").replace(/\*/g, "");
  return plain.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function baseStyles(accent: string): string {
  return `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: ${GRAY[100]}; }
  body {
    font-family: 'Pretendard', 'NanumGothic', sans-serif;
    color: ${COLORS.text}; font-size: 13px; line-height: 1.7; letter-spacing: -0.003em;
    word-break: keep-all; overflow-wrap: break-word; line-break: strict; hyphens: none;
  }
  /* A4 세로. height는 최소값 - 본문이 길면 이 블록만 자연스럽게 다음 물리 페이지로
     흘러넘치고, 다음 .page는 항상 새 페이지에서 시작한다(고정 캔버스에서 텍스트가
     잘리던 문제의 근본 원인을 제거). */
  .page {
    width: ${PAGE.width}px; min-height: ${PAGE.height}px; position: relative;
    background: ${COLORS.surface}; page-break-after: always;
    display: flex; flex-direction: column;
    padding: ${PAGE.margin}px ${PAGE.margin}px ${Math.round(PAGE.margin * 0.7)}px;
  }
  .page:last-child { page-break-after: auto; }
  .page-body { flex: 1 0 auto; }
  .accent { color: ${accent}; }
  .bg-accent { background: ${accent}; }
  h1, h2, h3, h4 { font-weight: 700; letter-spacing: -0.01em; orphans: 3; widows: 3; }
  p { margin: 0 0 8px; color: ${GRAY[700]}; orphans: 3; widows: 3; }
  ul { margin: 0 0 8px 18px; color: ${GRAY[700]}; }
  li { margin-bottom: 4px; }
  strong { color: ${COLORS.text}; font-weight: 700; }
  .avoid-break { break-inside: avoid; page-break-inside: avoid; }
  .header { display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; }
  .header .dash { width: 36px; height: 2px; background: ${GRAY[300]}; }
  .header .brand { font-size: 9.5px; font-weight: 700; color: ${GRAY[500]}; letter-spacing: 0.4px; }
  .footer { margin-top: auto; padding-top: 14px; display: flex; justify-content: space-between; font-size: 9px; color: ${GRAY[400]}; flex-shrink: 0; }
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
  return `<div class="header"><div style="display:flex;align-items:center;gap:12px;"><div class="dash"></div><span style="font-size:10.5px;color:${GRAY[500]};">${esc(breadcrumb)}</span></div><span class="brand">AUDIENCE &amp; IP INTELLIGENCE</span></div><div style="height:24px;flex-shrink:0;"></div>`;
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
  TEST: "확인 필요",
  EXPAND: "확장",
  CONNECT: "연결",
  PROTECT: "보호",
  REFRAME: "재정의",
  CORRECT: "교정",
  WATCH: "관찰 필요",
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
  const graphic = keywordConstellation(topKeywords, { width: 480, height: 340, accent });
  return `<section class="page" style="display:flex;flex-direction:column;padding:0;">
    <div style="padding:48px ${PAGE.margin}px 32px;background:${COLORS.panelTint};border-bottom:1px solid ${COLORS.border};">
      <div class="dash" style="margin-bottom:20px;"></div>
      <div style="font-size:11px;color:${GRAY[500]};margin-bottom:10px;letter-spacing:0.3px;">Audience &amp; IP Intelligence Report</div>
      <h1 style="font-size:34px;line-height:1.3;color:${COLORS.text};margin-bottom:20px;">${esc(keyword)}</h1>
      <div style="font-size:11px;color:${GRAY[600]};line-height:2;">
        <div>분석 기간 &nbsp;${esc(periodStart)} ~ ${esc(periodEnd)}</div>
        <div>데이터 &nbsp;영상 ${videoCount} · 댓글 ${commentCount}${postCount ? ` · X 게시물 ${postCount}` : ""}</div>
        <div>플랫폼 &nbsp;YouTube${postCount ? " · X" : ""}</div>
        <div>생성일 &nbsp;${esc(generatedAt)}</div>
      </div>
    </div>
    <div style="flex:1;position:relative;display:flex;align-items:center;justify-content:center;padding:20px;">
      ${graphic}
      <div style="position:absolute;bottom:24px;left:${PAGE.margin}px;font-size:9.5px;color:${GRAY[400]};">실제 상위 언급 키워드 기반 그래픽</div>
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

  return `<section class="page">
    ${header(params.breadcrumb)}
    <h2 style="font-size:24px;margin-bottom:6px;">핵심 지표</h2>
    <div style="font-size:12px;color:${GRAY[500]};margin-bottom:${params.disclaimer ? "16" : "24"}px;">이번 리서치에서 실제로 계산된 핵심 지표입니다.</div>
    ${
      params.disclaimer
        ? `<div style="background:${COLORS.warningTint};border-left:3px solid ${COLORS.warning};border-radius:6px;padding:10px 14px;margin-bottom:20px;font-size:11px;color:${GRAY[800]};">${esc(params.disclaimer)}</div>`
        : ""
    }
    <div style="display:flex;flex-wrap:wrap;gap:14px;">${cards}</div>
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
          <div style="font-size:10.5px;color:${GRAY[500]};margin-bottom:3px;line-height:1.4;"><strong style="color:${GRAY[600]};">근거</strong> ${esc(ins.evidence)}</div>
          <div style="font-size:10.5px;color:${GRAY[600]};line-height:1.4;"><strong style="color:${GRAY[600]};">의미</strong> ${esc(ins.implication)}</div>
        </div>
      </div>
    </div>`
    )
    .join("");

  return `<section class="page">
    ${header(params.breadcrumb)}
    <h2 style="font-size:20px;margin-bottom:4px;">핵심 발견 Top 5</h2>
    <div style="font-size:11px;color:${GRAY[500]};margin-bottom:16px;">이 페이지만 읽어도 리포트 핵심을 파악할 수 있습니다.</div>
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

  return `<section class="page">
    ${header(params.breadcrumb)}
    <h2 style="font-size:20px;margin-bottom:16px;">한눈에 보는 요약</h2>
    <div>${rows}</div>
    ${
      params.finalSentence
        ? `<div class="avoid-break" style="margin-top:20px;background:${params.accent}12;border-left:3px solid ${params.accent};border-radius:8px;padding:14px 20px;">
            <div style="font-size:9px;font-weight:700;color:${params.accent};letter-spacing:0.5px;margin-bottom:4px;">최종 결론</div>
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
  const bannerHtml = params.chapterIntro ? chapterBanner({ ...params.chapterIntro, accent: params.accent }) : "";

  if (!params.applicable || !params.primary) {
    return `<section class="page">
      ${header(params.breadcrumb)}
      ${bannerHtml}
      <div style="margin-top:${params.chapterIntro ? 8 : 16}px;">
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

  return `<section class="page">
    ${header(params.breadcrumb)}
    ${bannerHtml}
    <div style="margin-top:${params.chapterIntro ? 10 : 16}px;">
      <div style="font-size:10px;font-weight:700;color:${GRAY[500]};letter-spacing:0.5px;margin-bottom:8px;">${esc(params.moduleTitle.toUpperCase())}</div>
      <h2 style="font-size:19px;line-height:1.4;margin-bottom:14px;">${esc(p.headline)}</h2>
      <div style="font-size:12.5px;color:${GRAY[700]};line-height:1.7;margin-bottom:16px;">
        ${esc(p.interpretation)}
      </div>
      ${params.chartHtml ? `<div style="margin-bottom:16px;">${params.chartHtml}</div>` : ""}
      <div class="avoid-break" style="background:${GRAY[50]};border-radius:8px;padding:14px 18px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;gap:6px;flex-wrap:wrap;">
          <span style="font-size:9px;font-weight:700;color:${GRAY[500]};letter-spacing:0.4px;">근거</span>
          <div style="display:flex;gap:4px;">${confidenceBadge(p.confidence, params.accent)}${decisionBadge(p.decision, params.accent)}</div>
        </div>
        ${evidenceItems}
        <div style="font-size:9px;color:${GRAY[400]};margin-top:6px;">${esc(p.evidenceScope)}</div>
        ${p.theory ? `<div style="font-size:9.5px;color:${GRAY[400]};margin-top:8px;">이론: ${esc(p.theory)}</div>` : ""}
        ${bottleneckNote(p.possibleBottleneck)}
        ${
          p.relatedFindings && p.relatedFindings.length > 0
            ? `<div style="font-size:9px;color:${GRAY[500]};margin-top:8px;border-top:1px solid ${GRAY[200]};padding-top:6px;"><strong>같은 근거의 다른 발견</strong><br/>${p.relatedFindings.map((f) => esc(f)).join("<br/>")}</div>`
            : ""
        }
      </div>
      ${secondaryHtml ? `<div style="margin-top:6px;">${secondaryHtml}</div>` : ""}
      <div class="avoid-break" style="margin-top:16px;background:${params.accent}0F;border-left:3px solid ${params.accent};border-radius:8px;padding:11px 18px;">
        <div style="font-size:9px;font-weight:700;color:${params.accent};letter-spacing:0.4px;margin-bottom:3px;">지금 필요한 판단</div>
        <div style="font-size:11.5px;color:${GRAY[800]};">${esc(p.whyItMatters)} ${esc(p.strategicImplication)}</div>
      </div>
    </div>
    ${footer(params.reportTitle, params.pageNum)}
  </section>`;
}

// ---------------------------------------------------------------------------
// F-2. Evidence Page — 원본 영상/댓글 근거를 에디토리얼 카드로 (Insight 페이지 바로 다음에 붙는다)
// ---------------------------------------------------------------------------

function pdfCommentQuote(c: CommentEvidence, tag?: string): string {
  return `<div style="background:${GRAY[50]};border-radius:8px;padding:10px 12px;">
    ${tag ? `<div style="font-size:8.5px;font-weight:700;color:${GRAY[500]};letter-spacing:0.3px;margin-bottom:4px;">${esc(tag)}</div>` : ""}
    <div style="font-size:11px;color:${GRAY[800]};line-height:1.55;">&ldquo;${esc(c.text)}&rdquo;</div>
    <div style="font-size:9px;color:${GRAY[500]};margin-top:5px;">좋아요 ${c.likeCount.toLocaleString("ko-KR")}${c.videoTitle ? ` · ${esc(c.videoTitle)}` : ""}</div>
  </div>`;
}

function pdfQrBlock(qrDataUri: string | null, label: string): string {
  if (!qrDataUri) return "";
  return `<div style="display:flex;align-items:center;gap:10px;margin-top:10px;">
    <img src="${qrDataUri}" width="64" height="64" style="border-radius:4px;" />
    <div style="font-size:9.5px;color:${GRAY[600]};line-height:1.4;">${esc(label)}</div>
  </div>`;
}

/** Insight 하나를 뒷받침하는 실제 영상/댓글 근거를 보여주는 전용 페이지.
 * visualRecommendation이 no_visual이면 이 페이지 자체를 만들지 않는다(호출부에서 필터링). */
export function evidencePage(params: {
  breadcrumb: string;
  reportTitle: string;
  pageNum: number;
  insightHeadline: string;
  pkg: PdfEvidencePackage;
  accent: string;
}): string {
  const { pkg, accent } = params;
  const heroVideo = pkg.supportingVideos[0];

  const videoWidth = PAGE.width - PAGE.margin * 2;
  const videoHeight = Math.round((videoWidth * 9) / 16);
  const videoCardHtml = heroVideo
    ? `<div class="avoid-break">
        <div style="width:${videoWidth}px;height:${videoHeight}px;border-radius:10px;overflow:hidden;background:${GRAY[900]};position:relative;">
          ${
            heroVideo.thumbnailDataUri
              ? `<img src="${heroVideo.thumbnailDataUri}" width="${videoWidth}" height="${videoHeight}" style="object-fit:cover;display:block;" />`
              : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:${GRAY[400]};font-size:10.5px;">썸네일을 불러오지 못함</div>`
          }
        </div>
        <div style="margin-top:8px;font-size:12px;font-weight:700;color:${COLORS.text};line-height:1.4;">${esc(heroVideo.title || "제목 없음")}</div>
        <div style="font-size:10px;color:${GRAY[500]};margin-top:2px;">${esc(heroVideo.channelTitle)}${heroVideo.publishedAt ? ` · ${esc(heroVideo.publishedAt.slice(0, 10))}` : ""} · 이 근거로 쓰인 댓글 ${heroVideo.commentCount}건</div>
        ${pdfQrBlock(pkg.qrDataUri, pkg.qrTargetLabel)}
        <div style="margin-top:12px;display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          ${heroVideo.representativeComments.map((c) => pdfCommentQuote(c)).join("")}
        </div>
      </div>`
    : "";

  const collageHtml =
    !heroVideo && pkg.supportingComments.length > 0
      ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          ${pkg.supportingComments.slice(0, 6).map((c) => pdfCommentQuote(c)).join("")}
        </div>`
      : "";

  const secondaryVideosHtml =
    pkg.supportingVideos.length > 1
      ? `<div style="margin-top:16px;display:flex;flex-direction:column;gap:8px;">
          ${pkg.supportingVideos
            .slice(1, 3)
            .map(
              (v) => `<div style="display:flex;gap:8px;align-items:center;background:${GRAY[50]};border-radius:8px;padding:8px;">
                <div style="width:72px;height:40px;flex-shrink:0;border-radius:4px;overflow:hidden;background:${GRAY[300]};">
                  ${v.thumbnailDataUri ? `<img src="${v.thumbnailDataUri}" width="72" height="40" style="object-fit:cover;" />` : ""}
                </div>
                <div style="font-size:9.5px;color:${GRAY[700]};line-height:1.3;">${esc(v.title || "제목 없음")}<br/><span style="color:${GRAY[500]};">${esc(v.channelTitle)}</span></div>
              </div>`
            )
            .join("")}
        </div>`
      : "";

  return `<section class="page">
    ${header(params.breadcrumb)}
    <div>
      <div style="font-size:9px;font-weight:700;color:${accent};letter-spacing:0.5px;margin-bottom:6px;">영상·댓글 근거</div>
      <h3 style="font-size:15px;color:${COLORS.text};margin-bottom:14px;line-height:1.4;">${esc(params.insightHeadline)}</h3>
      ${videoCardHtml}
      ${collageHtml}
      ${secondaryVideosHtml}
      <div style="margin-top:16px;font-size:9.5px;color:${GRAY[500]};">${esc([pkg.repetitionSummary, pkg.engagementSummary].filter(Boolean).join(" · "))}</div>
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
  const col = (title: string, items: { label: string; evidence: string }[], color: string) =>
    items.length === 0
      ? ""
      : `<div>
      <div style="font-size:11px;font-weight:700;color:${color};letter-spacing:0.4px;margin-bottom:10px;">${title}</div>
      ${items
        .slice(0, 3)
        .map(
          (it) => `<div style="background:${GRAY[50]};border-radius:8px;padding:10px 12px;margin-bottom:8px;">
        <div style="font-size:11.5px;font-weight:700;color:${COLORS.text};margin-bottom:3px;">${esc(it.label)}</div>
        <div style="font-size:9.5px;color:${GRAY[500]};">${esc(it.evidence)}</div>
      </div>`
        )
        .join("")}
    </div>`;

  const bannerHtml = params.chapterIntro ? chapterBanner({ ...params.chapterIntro, accent: params.accent }) : "";

  return `<section class="page">
    ${header(params.breadcrumb)}
    ${bannerHtml}
    <h2 style="font-size:20px;margin-top:${params.chapterIntro ? 10 : 0}px;margin-bottom:16px;">강점·위험 진단</h2>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      ${col("확고한 강점", params.strong, COLORS.positive)}
      ${col("숨은 자산", params.hidden, params.accent)}
      ${col("약한 신호", params.weak, COLORS.warning)}
      ${col("위험 요인", params.risks, COLORS.risk)}
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

  return `<section class="page">
    ${header(params.breadcrumb)}
    <h2 style="font-size:20px;margin-bottom:16px;">관심에서 행동까지</h2>
    <div style="margin-bottom:20px;">${params.funnelSvg}</div>
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
    return `<section class="page">
      ${header(params.breadcrumb)}
      <h2 style="font-size:20px;margin-bottom:16px;">캐릭터 구조</h2>
      <div class="chart-empty">이 ${esc(params.ipLabel)}은(는) 캐릭터 구조 분석에 필요한 데이터 근거가 부족합니다.</div>
      ${footer(params.reportTitle, params.pageNum)}
    </section>`;
  }
  const rows = params.layers
    .map(
      (l, i) => `<div class="avoid-break" style="display:flex;gap:16px;margin-bottom:14px;">
      <div style="width:100px;flex-shrink:0;">
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

  return `<section class="page">
    ${header(params.breadcrumb)}
    <h2 style="font-size:20px;margin-bottom:4px;">캐릭터 구조</h2>
    <div style="font-size:11px;color:${GRAY[500]};margin-bottom:16px;">${esc(params.ipLabel)}의 캐릭터를 4개 레이어로 분해</div>
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

  return `<section class="page">
    ${header(params.breadcrumb)}
    <h2 style="font-size:20px;margin-bottom:6px;">기회 매트릭스</h2>
    <div style="font-size:11px;color:${GRAY[500]};margin-bottom:16px;">X축: 대중 확장 잠재력 · Y축: 근거 강도 (번호는 아래 목록과 매칭)</div>
    <div class="avoid-break" style="display:flex;justify-content:center;margin-bottom:16px;">${params.matrixSvg}</div>
    <div>${list || `<div class="chart-empty">데이터 부족</div>`}</div>
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
  return `<section class="page">
    ${header(params.breadcrumb)}
    ${bannerHtml}
    <h2 style="font-size:20px;margin-top:${params.chapterIntro ? 10 : 0}px;margin-bottom:16px;">인식 지도</h2>
    <div style="display:flex;justify-content:center;">${params.axisSvg}</div>
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
  const col = (title: string, items: { label: string; evidence: string }[], color: string) =>
    items.length === 0
      ? ""
      : `<div class="avoid-break" style="margin-bottom:14px;">
      <div style="display:inline-block;font-size:10.5px;font-weight:700;color:white;background:${color};border-radius:6px;padding:5px 12px;margin-bottom:10px;letter-spacing:0.5px;">${title}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        ${items
          .slice(0, 3)
          .map(
            (it) => `<div style="border:1px solid ${GRAY[200]};border-radius:8px;padding:10px 12px;">
              <div style="font-size:11px;font-weight:700;margin-bottom:3px;">${esc(it.label)}</div>
              <div style="font-size:9px;color:${GRAY[500]};">${esc(it.evidence)}</div>
            </div>`
          )
          .join("")}
      </div>
    </div>`;

  return `<section class="page">
    ${header(params.breadcrumb)}
    <h2 style="font-size:20px;margin-bottom:16px;">유지·발견·창조</h2>
    ${col("유지 (KEEP)", params.keep, COLORS.positive)}
    ${col("발견 (DISCOVER)", params.discover, params.accent)}
    ${col("창조 (CREATE)", params.create, COLORS.warning)}
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

  const finalBox = (label: string, value: string, color: string) =>
    !value
      ? ""
      : `<div class="avoid-break" style="background:${color}12;border-radius:8px;padding:12px 14px;margin-bottom:10px;">
      <div style="font-size:9px;font-weight:700;color:${color};letter-spacing:0.4px;margin-bottom:4px;">${label}</div>
      <div style="font-size:11px;color:${GRAY[800]};line-height:1.5;">${esc(value)}</div>
    </div>`;

  return `<section class="page">
    ${header(params.breadcrumb)}
    <h2 style="font-size:20px;margin-bottom:4px;">포지셔닝 후보</h2>
    <div style="font-size:11px;color:${GRAY[500]};margin-bottom:16px;">Positioning 후보와 최종 추천 포지션</div>
    <div style="margin-bottom:14px;">${rows || `<div class="chart-empty">데이터 부족</div>`}</div>
    ${finalBox("핵심 포지션", params.core, params.accent)}
    ${finalBox("보조 포지션", params.supporting, GRAY[600])}
    ${finalBox("신흥 포지션", params.emerging, COLORS.warning)}
    ${footer(params.reportTitle, params.pageNum)}
  </section>`;
}

// ---------------------------------------------------------------------------
// N. Strategy Page (13종 Decision을 4개 실행 티어로 묶어 배치)
// ---------------------------------------------------------------------------
const DECISION_LABEL: Record<string, string> = {
  KEEP: "유지",
  REPEAT: "반복",
  AMPLIFY: "확대",
  CLARIFY: "명확화",
  TEST: "확인 필요",
  EXPAND: "확장",
  CONNECT: "연결",
  PROTECT: "보호",
  REFRAME: "재정의",
  CORRECT: "교정",
  WATCH: "관찰 필요",
  AVOID: "보류",
  NO_CHANGE: "현행 유지",
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
    <div class="avoid-break" style="border:1px solid ${GRAY[200]};border-radius:8px;padding:11px 14px;margin-bottom:8px;">
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

  const groups = ["act", "test", "watch", "avoid"]
    .map((tier) => {
      const items = params.recommendations.filter((r) => (DECISION_TIER[r.decision] ?? "watch") === tier);
      if (items.length === 0) return "";
      return `<div style="margin-bottom:12px;">
      <div style="font-size:10px;font-weight:700;color:${tierColor(tier)};letter-spacing:0.4px;margin-bottom:8px;">${TIER_LABEL[tier]}</div>
      ${items.map(card).join("")}
    </div>`;
    })
    .join("");

  return `<section class="page">
    ${header(params.breadcrumb)}
    <h2 style="font-size:19px;margin-bottom:4px;">그래서 지금 무엇을 어떻게 움직여야 하는가</h2>
    <div style="font-size:11px;color:${GRAY[500]};margin-bottom:16px;">실제 데이터에 맞는 판단만 선택했다 — 모든 리포트가 같은 조합을 갖지 않는다</div>
    <div>${groups}</div>
    ${
      params.appendixIdeas.length > 0
        ? `<div style="margin-top:8px;">
            <div style="font-size:9px;font-weight:700;color:${GRAY[500]};letter-spacing:0.4px;margin-bottom:4px;">그 외 아이디어</div>
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
  academic: { title: string; url: string; note: string; qrDataUri?: string | null }[];
  context: { title: string; url: string; note: string; qrDataUri?: string | null }[];
  accent: string;
}): string {
  const cardsFor = (refs: { title: string; url: string; note: string; qrDataUri?: string | null }[]) =>
    refs
      .slice(0, 2)
      .map(
        (r) => `<div style="width:calc(50% - 8px);border:1px solid ${GRAY[200]};border-radius:10px;padding:14px;display:flex;gap:12px;">
      <div style="flex:1;">
        <div style="font-size:12px;font-weight:700;color:${COLORS.text};margin-bottom:6px;line-height:1.4;">${esc(r.title)}</div>
        <div style="font-size:9.5px;color:${GRAY[500]};margin-bottom:8px;">${esc(r.note)}</div>
        <div style="font-size:8.5px;color:${GRAY[400]};word-break:break-all;">${esc(r.url)}</div>
      </div>
      ${r.qrDataUri ? `<img src="${r.qrDataUri}" width="52" height="52" style="flex-shrink:0;border-radius:4px;" />` : ""}
    </div>`
      )
      .join("");

  const section = (title: string, refs: { title: string; url: string; note: string; qrDataUri?: string | null }[]) =>
    refs.length === 0
      ? ""
      : `<div style="margin-bottom:18px;">
      <div style="font-size:10px;font-weight:700;color:${params.accent};letter-spacing:0.4px;margin-bottom:10px;">${title}</div>
      <div style="display:flex;flex-wrap:wrap;gap:16px;">${cardsFor(refs)}</div>
    </div>`;

  const hasAny = params.academic.length + params.context.length > 0;

  return `<section class="page">
    ${header(params.breadcrumb)}
    <h2 style="font-size:20px;margin-bottom:16px;">참고 자료</h2>
    ${hasAny ? `${section("학술·연구 자료", params.academic)}${section("맥락 자료", params.context)}` : `<div class="chart-empty">검증된 외부 자료를 찾지 못했습니다</div>`}
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
  return `<section class="page">
    ${header(params.breadcrumb)}
    <h2 style="font-size:18px;margin-bottom:14px;line-height:1.4;">${esc(params.headline)}</h2>
    <div style="font-size:12px;">${params.bodyHtml}</div>
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
