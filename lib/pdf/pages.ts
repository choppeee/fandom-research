import { COLORS, GRAY, PAGE, evidenceDots } from "./tokens";
import { confidenceMeter } from "./charts";

function esc(s: string): string {
  const plain = String(s ?? "").replace(/\*/g, "");
  return plain.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function baseStyles(accent: string): string {
  return `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: ${GRAY[100]}; }
  body { font-family: 'NanumGothic', sans-serif; color: ${COLORS.text}; font-size: 12.5px; line-height: 1.55; }
  .page { width: ${PAGE.width}px; height: ${PAGE.height}px; position: relative; background: white; overflow: hidden; page-break-after: always; }
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
  .badge-accent { background: ${accent}22; color: ${accent}; }
  .quote-card { background: ${GRAY[50]}; border-left: 3px solid ${accent}; border-radius: 6px; padding: 12px 16px; font-size: 12px; color: ${GRAY[800]}; font-style: italic; }
  .quote-source { font-size: 9.5px; color: ${GRAY[500]}; margin-top: 6px; font-style: normal; }
  `;
}

export function header(breadcrumb: string): string {
  return `<div class="header"><div style="display:flex;align-items:center;gap:12px;"><div class="dash"></div><span style="font-size:10.5px;color:${GRAY[500]};">${esc(breadcrumb)}</span></div><span class="brand">FANDOM RESEARCH</span></div>`;
}

export function footer(reportTitle: string, pageNum: number): string {
  return `<div class="footer"><span>${esc(reportTitle)}</span><span>${pageNum}</span></div>`;
}

// ---------------------------------------------------------------------------
// A. Cover
// ---------------------------------------------------------------------------
export function coverPage(params: {
  keyword: string;
  periodStart: string;
  periodEnd: string;
  videoCount: number;
  commentCount: number;
  postCount: number;
  generatedAt: string;
  accent: string;
}): string {
  const { keyword, periodStart, periodEnd, videoCount, commentCount, postCount, generatedAt, accent } = params;
  return `<section class="page" style="display:flex;">
    <div style="width:420px;background:${COLORS.panelTint};padding:56px 40px;display:flex;flex-direction:column;justify-content:center;">
      <div class="dash" style="margin-bottom:20px;"></div>
      <div style="font-size:11px;color:${GRAY[500]};margin-bottom:10px;">Audience &amp; IP Intelligence Report</div>
      <h1 style="font-size:30px;line-height:1.3;color:${COLORS.text};margin-bottom:24px;">${esc(keyword)}</h1>
      <div style="font-size:11px;color:${GRAY[600]};line-height:2;">
        <div>분석 기간 &nbsp;${esc(periodStart)} ~ ${esc(periodEnd)}</div>
        <div>데이터 &nbsp;영상 ${videoCount} · 댓글 ${commentCount}${postCount ? ` · X 게시물 ${postCount}` : ""}</div>
        <div>플랫폼 &nbsp;YouTube${postCount ? " · X" : ""}</div>
        <div>생성일 &nbsp;${esc(generatedAt)}</div>
      </div>
    </div>
    <div style="flex:1;position:relative;display:flex;align-items:center;justify-content:center;">
      <svg width="380" height="380" viewBox="0 0 380 380">
        <circle cx="190" cy="190" r="150" fill="${accent}0D" />
        <circle cx="190" cy="190" r="110" fill="${accent}17" />
        <circle cx="190" cy="190" r="70" fill="${accent}26" />
        <circle cx="190" cy="130" r="10" fill="${accent}" />
        <circle cx="240" cy="210" r="7" fill="${COLORS.primary}" />
        <circle cx="150" cy="230" r="5" fill="${accent}" />
      </svg>
    </div>
  </section>`;
}

// ---------------------------------------------------------------------------
// B. Section Divider
// ---------------------------------------------------------------------------
export function sectionDividerPage(params: { num: string; title: string; subtitle: string; accent: string }): string {
  return `<section class="page" style="background:${COLORS.panelTint};padding:${PAGE.margin}px;">
    <div class="dash"></div>
    <div style="position:absolute;top:280px;left:${PAGE.margin}px;">
      <div style="font-size:15px;color:${params.accent};font-weight:700;margin-bottom:6px;">${esc(params.num)}</div>
      <h1 style="font-size:34px;color:${COLORS.text};margin-bottom:14px;">${esc(params.title)}</h1>
      <div style="font-size:13px;color:${GRAY[600]};max-width:520px;">${esc(params.subtitle)}</div>
    </div>
    <svg width="200" height="200" style="position:absolute;right:80px;bottom:100px;" viewBox="0 0 200 200">
      <rect x="20" y="20" width="160" height="160" rx="24" fill="${params.accent}14" />
      <rect x="50" y="50" width="100" height="100" rx="16" fill="${params.accent}28" />
    </svg>
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
    <div style="font-size:12px;color:${GRAY[500]};margin-bottom:32px;">이번 리서치에서 실제로 계산된 핵심 지표입니다.</div>
    <div style="display:flex;flex-wrap:wrap;gap:16px;">${cards}</div>
    ${footer(params.reportTitle, params.pageNum)}
  </section>`;
}

// ---------------------------------------------------------------------------
// D. Executive Summary - Top 5 Insight Cards
// ---------------------------------------------------------------------------
export function execSummaryCardsPage(params: {
  breadcrumb: string;
  reportTitle: string;
  pageNum: number;
  insights: { headline: string; evidence: string; implication: string }[];
  startIndex: number;
  title: string;
  accent: string;
}): string {
  const cards = params.insights
    .map(
      (ins, i) => `<div style="border:1px solid ${GRAY[200]};border-radius:10px;padding:13px 16px;margin-bottom:11px;">
      <div style="display:flex;gap:14px;">
        <div style="font-size:18px;font-weight:700;color:${params.accent};width:30px;flex-shrink:0;">${String(params.startIndex + i + 1).padStart(2, "0")}</div>
        <div style="flex:1;">
          <div style="font-size:12.5px;font-weight:700;color:${COLORS.text};margin-bottom:5px;line-height:1.4;">${esc(ins.headline)}</div>
          <div style="font-size:10px;color:${GRAY[500]};margin-bottom:3px;line-height:1.4;"><strong style="color:${GRAY[600]};">Evidence</strong> ${esc(ins.evidence)}</div>
          <div style="font-size:10px;color:${GRAY[600]};line-height:1.4;"><strong style="color:${GRAY[600]};">Implication</strong> ${esc(ins.implication)}</div>
        </div>
      </div>
    </div>`
    )
    .join("");

  return `<section class="page" style="padding:${PAGE.margin}px;">
    ${header(params.breadcrumb)}
    <h2 style="font-size:22px;margin-top:70px;margin-bottom:16px;">${esc(params.title)}</h2>
    <div>${cards}</div>
    ${footer(params.reportTitle, params.pageNum)}
  </section>`;
}

// ---------------------------------------------------------------------------
// E. Executive Summary - Strategy at a Glance (flow diagram)
// ---------------------------------------------------------------------------
export function execStrategyDiagramPage(params: {
  breadcrumb: string;
  reportTitle: string;
  pageNum: number;
  steps: { label: string; value: string }[];
  accent: string;
}): string {
  const rows = params.steps
    .map(
      (s, i) => `
      <div style="display:flex;align-items:flex-start;gap:16px;">
        <div style="width:120px;flex-shrink:0;text-align:right;font-size:10px;font-weight:700;letter-spacing:0.4px;color:${params.accent};padding-top:4px;">${esc(s.label)}</div>
        <div style="flex:1;background:${GRAY[50]};border-radius:8px;padding:12px 16px;font-size:12px;color:${GRAY[800]};">${esc(s.value)}</div>
      </div>
      ${i < params.steps.length - 1 ? `<div style="margin-left:128px;color:${GRAY[300]};font-size:14px;">↓</div>` : ""}
    `
    )
    .join("");

  return `<section class="page" style="padding:${PAGE.margin}px;">
    ${header(params.breadcrumb)}
    <h2 style="font-size:24px;margin-top:70px;margin-bottom:20px;">IP STRATEGY AT A GLANCE</h2>
    <div>${rows}</div>
    ${footer(params.reportTitle, params.pageNum)}
  </section>`;
}

// ---------------------------------------------------------------------------
// F. Generic Insight / Text page (paginated module content)
// ---------------------------------------------------------------------------
export function textPage(params: {
  breadcrumb: string;
  headline: string;
  bodyHtml: string;
  reportTitle: string;
  pageNum: number;
  chartHtml?: string;
  takeaway?: string;
  evidenceLevel?: string;
  accent: string;
}): string {
  return `<section class="page" style="padding:${PAGE.margin}px;">
    ${header(params.breadcrumb)}
    <h2 style="font-size:19px;margin-top:64px;margin-bottom:16px;max-width:1080px;line-height:1.4;">${esc(params.headline)}</h2>
    <div style="display:flex;gap:32px;">
      <div style="flex:1;max-width:${params.chartHtml ? "560" : "1080"}px;font-size:12px;">${params.bodyHtml}</div>
      ${params.chartHtml ? `<div style="flex-shrink:0;">${params.chartHtml}</div>` : ""}
    </div>
    ${
      params.takeaway
        ? `<div style="position:absolute;left:${PAGE.margin}px;right:${PAGE.margin}px;bottom:60px;background:${COLORS.panelTint};border-radius:8px;padding:12px 18px;">
            <div style="font-size:9.5px;font-weight:700;color:${params.accent};letter-spacing:0.4px;margin-bottom:4px;">STRATEGIC TAKEAWAY</div>
            <div style="font-size:11.5px;color:${GRAY[800]};">${esc(params.takeaway)}</div>
          </div>`
        : ""
    }
    ${
      params.evidenceLevel
        ? `<div style="position:absolute;top:34px;right:${PAGE.margin}px;font-size:9px;color:${GRAY[500]};">${evidenceDots(params.evidenceLevel)}</div>`
        : ""
    }
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
              .slice(0, 4)
              .map(
                (it) => `<div style="background:${GRAY[50]};border-radius:8px;padding:10px 12px;margin-bottom:8px;">
                <div style="font-size:11.5px;font-weight:700;color:${COLORS.text};margin-bottom:3px;">${esc(it.label)}</div>
                <div style="font-size:9.5px;color:${GRAY[500]};">${esc(it.evidence)}</div>
              </div>`
              )
              .join("")
      }
    </div>`;

  return `<section class="page" style="padding:${PAGE.margin}px;">
    ${header(params.breadcrumb)}
    <h2 style="font-size:22px;margin-top:64px;margin-bottom:20px;">IP DIAGNOSTIC DASHBOARD</h2>
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
      (l, i) => `<div style="display:flex;gap:20px;margin-bottom:16px;">
      <div style="width:120px;flex-shrink:0;">
        <div style="font-size:10px;font-weight:700;color:${params.accent};">${esc(l.layer)}</div>
        <div style="width:2px;height:${i < params.layers.length - 1 ? "40" : "0"}px;background:${GRAY[200]};margin:8px auto 0;"></div>
      </div>
      <div style="flex:1;background:${GRAY[50]};border-radius:8px;padding:12px 16px;">
        <div style="font-size:13px;font-weight:700;color:${COLORS.text};margin-bottom:4px;">${esc(l.label)}</div>
        <div style="font-size:10.5px;color:${GRAY[500]};">${esc(l.evidence)}</div>
      </div>
    </div>`
    )
    .join("");

  return `<section class="page" style="padding:${PAGE.margin}px;">
    ${header(params.breadcrumb)}
    <h2 style="font-size:22px;margin-top:64px;margin-bottom:4px;">CHARACTER ARCHITECTURE</h2>
    <div style="font-size:11px;color:${GRAY[500]};margin-bottom:24px;">${esc(params.ipLabel)}의 캐릭터를 4개 레이어로 분해</div>
    <div>${rows}</div>
    ${footer(params.reportTitle, params.pageNum)}
  </section>`;
}

// ---------------------------------------------------------------------------
// J. Opportunity Matrix (2x2)
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
    .slice(0, 5)
    .map(
      (n) => `<div style="margin-bottom:8px;font-size:10.5px;"><strong>${esc(n.label)}</strong> — <span style="color:${GRAY[500]};">${esc(n.note)}</span></div>`
    )
    .join("");

  return `<section class="page" style="padding:${PAGE.margin}px;">
    ${header(params.breadcrumb)}
    <h2 style="font-size:22px;margin-top:64px;margin-bottom:6px;">OPPORTUNITY MATRIX</h2>
    <div style="font-size:11px;color:${GRAY[500]};margin-bottom:16px;">X축: 대중 확장 잠재력 · Y축: 근거 강도</div>
    <div style="display:flex;gap:24px;">
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
  axisSvg: string;
  accent: string;
}): string {
  return `<section class="page" style="padding:${PAGE.margin}px;">
    ${header(params.breadcrumb)}
    <h2 style="font-size:22px;margin-top:64px;margin-bottom:24px;">PERCEPTION MAP</h2>
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
// M. Reference Cards
// ---------------------------------------------------------------------------
export function referencePage(params: {
  breadcrumb: string;
  reportTitle: string;
  pageNum: number;
  refs: { title: string; url: string; note: string }[];
  accent: string;
}): string {
  const cards = params.refs
    .slice(0, 4)
    .map(
      (r) => `<div style="width:calc(50% - 10px);border:1px solid ${GRAY[200]};border-radius:10px;padding:16px;">
      <div style="font-size:9px;color:${params.accent};font-weight:700;letter-spacing:0.4px;margin-bottom:8px;">RESEARCH REFERENCE</div>
      <div style="font-size:12.5px;font-weight:700;color:${COLORS.text};margin-bottom:8px;line-height:1.4;">${esc(r.title)}</div>
      <div style="font-size:10px;color:${GRAY[500]};margin-bottom:10px;">${esc(r.note)}</div>
      <div style="font-size:9px;color:${GRAY[400]};word-break:break-all;">${esc(r.url)}</div>
    </div>`
    )
    .join("");

  return `<section class="page" style="padding:${PAGE.margin}px;">
    ${header(params.breadcrumb)}
    <h2 style="font-size:22px;margin-top:64px;margin-bottom:20px;">RESEARCH REFERENCES</h2>
    <div style="display:flex;flex-wrap:wrap;gap:20px;">${cards || `<div class="chart-empty">검증된 외부 자료를 찾지 못했습니다</div>`}</div>
    ${footer(params.reportTitle, params.pageNum)}
  </section>`;
}

// ---------------------------------------------------------------------------
// N. Quote card (used inline inside textPage bodies)
// ---------------------------------------------------------------------------
export function quoteCard(text: string, source: string, tag?: string): string {
  return `<div class="quote-card" style="margin-bottom:10px;">
    “${esc(text)}”
    <div class="quote-source">— ${esc(source)} ${tag ? `<span class="badge badge-accent" style="margin-left:6px;">${esc(tag)}</span>` : ""}</div>
  </div>`;
}

// ---------------------------------------------------------------------------
// O. Back cover
// ---------------------------------------------------------------------------
export function backCoverPage(params: { accent: string }): string {
  return `<section class="page" style="background:${COLORS.panelTint};display:flex;align-items:center;justify-content:center;">
    <div style="text-align:center;">
      <div style="font-size:11px;color:${GRAY[500]};letter-spacing:1px;margin-bottom:8px;">END OF REPORT</div>
      <div style="font-size:13px;color:${GRAY[600]};">본 리포트는 AI 분석 추정치를 포함하며, 원문 인용은 출처 확인을 위한 소량 예시입니다.</div>
    </div>
  </section>`;
}
