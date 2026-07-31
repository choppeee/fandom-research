import fs from "fs";
import path from "path";
import { COLORS, accentForKeyword } from "./tokens";
import {
  baseStyles,
  coverPage,
  sectionDividerPage,
  kpiDashboardPage,
  execSummaryCardsPage,
  execStrategyDiagramPage,
  textPage,
  diagnosticDashboardPage,
  audienceFunnelPage,
  characterArchitecturePage,
  opportunityMatrixPage,
  perceptionMapPage,
  opportunityMapPage,
  referencePage,
  backCoverPage,
} from "./pages";
import { barChartHorizontal, donutChart, areaTimelineChart, funnelChart, matrix2x2, bipolarAxisChart } from "./charts";
import { markdownToBlocks, paginateBlocks, stripLeadingHeading } from "./markdown";
import { parseTop5Insights, parseFinalConclusion } from "./parse-summary";
import type { VisualData } from "../visual-data";
import type { Aggregates } from "../aggregate";

export type ModuleContent = { moduleKey: string; title: string; content: string };

export type ReportData = {
  keyword: string;
  periodStart: string;
  periodEnd: string;
  videoCount: number;
  commentCount: number;
  postCount: number;
  generatedAt: string;
  stats: Aggregates;
  modules: ModuleContent[];
  visualData: VisualData;
  researchReferences: { title: string; url: string; snippet: string; connectionNote: string }[];
  executiveSummaryMd: string;
  finalConclusionMd: string;
};

const FONT_REGULAR = path.join(process.cwd(), "assets/fonts/NanumGothic-Regular.ttf");
const FONT_BOLD = path.join(process.cwd(), "assets/fonts/NanumGothic-Bold.ttf");

function fontFaceCss(): string {
  const regular = fs.readFileSync(FONT_REGULAR).toString("base64");
  const bold = fs.readFileSync(FONT_BOLD).toString("base64");
  return `
  @font-face { font-family: 'NanumGothic'; font-weight: 400; src: url(data:font/ttf;base64,${regular}) format('truetype'); }
  @font-face { font-family: 'NanumGothic'; font-weight: 700; src: url(data:font/ttf;base64,${bold}) format('truetype'); }
  `;
}

function moduleTextPages(
  mod: ModuleContent,
  breadcrumb: string,
  reportTitle: string,
  accent: string,
  pageNumRef: { n: number }
): string[] {
  const blocks = markdownToBlocks(stripLeadingHeading(mod.content));
  const pageGroups = paginateBlocks(blocks, 150);
  return pageGroups.map((group, i) =>
    textPage({
      breadcrumb,
      headline: i === 0 ? mod.title : `${mod.title} (계속)`,
      bodyHtml: group.join(""),
      reportTitle,
      pageNum: pageNumRef.n++,
      accent,
    })
  );
}

export function buildReportHtml(data: ReportData): string {
  const accent = accentForKeyword(data.keyword);
  const reportTitle = `${data.keyword} · IP Intelligence Report`;
  const pageNum = { n: 1 };
  const pages: string[] = [];

  // --- Cover ---
  pages.push(
    coverPage({
      keyword: data.keyword,
      periodStart: data.periodStart,
      periodEnd: data.periodEnd,
      videoCount: data.videoCount,
      commentCount: data.commentCount,
      postCount: data.postCount,
      generatedAt: data.generatedAt,
      accent,
    })
  );
  pageNum.n++;

  const byKey = new Map(data.modules.map((m) => [m.moduleKey, m]));
  const modPages = (key: string, breadcrumb: string) => {
    const m = byKey.get(key);
    if (!m || !m.content.trim()) return [] as string[];
    return moduleTextPages(m, breadcrumb, reportTitle, accent, pageNum);
  };

  // --- Section 01: OVERVIEW ---
  pages.push(sectionDividerPage({ num: "01", title: "OVERVIEW", subtitle: "핵심 지표와 전략 결론 요약", accent }));
  pageNum.n++;

  pages.push(
    kpiDashboardPage({
      breadcrumb: "01 Overview",
      reportTitle,
      pageNum: pageNum.n++,
      accent,
      kpis: [
        { label: "TOTAL DATA", value: String(data.videoCount + data.commentCount + data.postCount) },
        { label: "VIDEOS", value: String(data.videoCount) },
        { label: "COMMENTS / POSTS", value: String(data.commentCount + data.postCount) },
        { label: "POSITIVE", value: `${data.stats.sentimentRatio.positive}%` },
        { label: "NEGATIVE", value: `${data.stats.sentimentRatio.negative}%` },
        { label: "PURCHASE INTENT", value: `${data.stats.purchaseIntentSummary.positiveRatio}%` },
        {
          label: "TOP CHARACTER TRAIT",
          value: data.visualData.characterArchitecture.layers.find((l) => l.layer === "CORE")?.label ?? "-",
        },
        { label: "RISK ALERTS", value: String(data.stats.riskGroups.reduce((s, g) => s + g.count, 0)) },
      ],
    })
  );

  const top5 = parseTop5Insights(data.executiveSummaryMd);
  if (top5.length > 0) {
    const firstChunk = top5.slice(0, 3);
    const restChunk = top5.slice(3);
    pages.push(
      execSummaryCardsPage({
        breadcrumb: "01 Overview",
        reportTitle,
        pageNum: pageNum.n++,
        insights: firstChunk,
        startIndex: 0,
        title: "TOP 5 INSIGHTS",
        accent,
      })
    );
    if (restChunk.length > 0) {
      pages.push(
        execSummaryCardsPage({
          breadcrumb: "01 Overview",
          reportTitle,
          pageNum: pageNum.n++,
          insights: restChunk,
          startIndex: 3,
          title: "TOP 5 INSIGHTS (계속)",
          accent,
        })
      );
    }
  }

  const conclusionSteps = parseFinalConclusion(data.finalConclusionMd);
  if (conclusionSteps.length > 0) {
    pages.push(
      execStrategyDiagramPage({
        breadcrumb: "01 Overview",
        reportTitle,
        pageNum: pageNum.n++,
        steps: conclusionSteps,
        accent,
      })
    );
  }

  // Data viz: sentiment donut + top keywords + timeline
  const donutSvg = donutChart(
    [
      { label: "긍정", value: data.stats.sentimentRatio.positive, color: COLORS.positive },
      { label: "부정", value: data.stats.sentimentRatio.negative, color: COLORS.risk },
      { label: "중립", value: data.stats.sentimentRatio.neutral, color: "#B8B0D0" },
    ],
    { size: 180 }
  );
  const keywordSvg = barChartHorizontal(
    data.stats.topKeywords.slice(0, 8).map((k) => ({ label: k.keyword, value: k.count })),
    { width: 460 }
  );
  const timelineSvg = areaTimelineChart(data.stats.dailyTrend, { width: 1080, height: 200 });

  pages.push(`<section class="page" style="padding:56px;">
    <div class="header"><div style="display:flex;align-items:center;gap:12px;"><div class="dash"></div><span style="font-size:10.5px;color:#6B6478;">01 Overview</span></div><span class="brand">FANDOM RESEARCH</span></div>
    <h2 style="font-size:22px;margin-top:64px;margin-bottom:24px;">SENTIMENT &amp; TOPIC DISTRIBUTION</h2>
    <div style="display:flex;gap:40px;align-items:flex-start;">
      <div>${donutSvg}</div>
      <div>${keywordSvg}</div>
    </div>
    <div style="margin-top:20px;">
      <div style="font-size:10.5px;color:#6B6478;margin-bottom:8px;">언급량 · 참여량 추이</div>
      ${timelineSvg}
    </div>
    <div class="footer"><span>${reportTitle}</span><span>${pageNum.n++}</span></div>
  </section>`);

  // --- Section 02: AUDIENCE ---
  pages.push(sectionDividerPage({ num: "02", title: "AUDIENCE", subtitle: "누가, 왜 반응하는가", accent }));
  pageNum.n++;
  pages.push(...modPages("audience_perception", "02 Audience"));
  pages.push(...modPages("audience_segments", "02 Audience"));
  pages.push(...modPages("conversion_signals", "02 Audience"));
  pages.push(...modPages("appeal_drivers", "02 Audience"));

  // --- Section 03: PERCEPTION & PSYCHOLOGY ---
  pages.push(
    sectionDividerPage({ num: "03", title: "PERCEPTION & PSYCHOLOGY", subtitle: "대중 인식의 구조와 심리적 동인", accent })
  );
  pageNum.n++;
  if (data.visualData.perceptionMap.axes.length > 0) {
    const axisSvg = bipolarAxisChart(
      data.visualData.perceptionMap.axes.map((a) => ({
        leftLabel: a.leftLabel,
        rightLabel: a.rightLabel,
        position: a.position,
      })),
      { width: 900 }
    );
    pages.push(perceptionMapPage({ breadcrumb: "03 Perception", reportTitle, pageNum: pageNum.n++, axisSvg, accent }));
  }
  pages.push(...modPages("psychological_drivers", "03 Perception"));
  pages.push(...modPages("platform_youtube", "03 Perception"));
  pages.push(...modPages("platform_x", "03 Perception"));
  pages.push(...modPages("cross_platform", "03 Perception"));

  // --- Section 04: CHARACTER ---
  pages.push(sectionDividerPage({ num: "04", title: "CHARACTER", subtitle: "IP의 캐릭터 구조 분해", accent }));
  pageNum.n++;
  pages.push(
    characterArchitecturePage({
      breadcrumb: "04 Character",
      reportTitle,
      pageNum: pageNum.n++,
      ipLabel: data.visualData.ipLabel,
      layers: data.visualData.characterArchitecture.applicable ? data.visualData.characterArchitecture.layers : [],
      accent,
    })
  );
  pages.push(...modPages("character_traits", "04 Character"));
  pages.push(...modPages("relationship_dynamics", "04 Character"));
  pages.push(...modPages("viral_mechanics", "04 Character"));

  // --- Section 05: OPPORTUNITY & STRATEGY ---
  pages.push(
    sectionDividerPage({ num: "05", title: "OPPORTUNITY & STRATEGY", subtitle: "숨은 가치에서 실행 전략까지", accent })
  );
  pageNum.n++;

  pages.push(
    diagnosticDashboardPage({
      breadcrumb: "05 Opportunity",
      reportTitle,
      pageNum: pageNum.n++,
      strong: data.visualData.diagnostic.strongAssets,
      hidden: data.visualData.diagnostic.hiddenAssets,
      weak: data.visualData.diagnostic.weakSignals,
      risks: data.visualData.diagnostic.risks,
      accent,
    })
  );

  if (
    data.visualData.opportunityMap.keep.length +
      data.visualData.opportunityMap.discover.length +
      data.visualData.opportunityMap.create.length >
    0
  ) {
    pages.push(
      opportunityMapPage({
        breadcrumb: "05 Opportunity",
        reportTitle,
        pageNum: pageNum.n++,
        keep: data.visualData.opportunityMap.keep,
        discover: data.visualData.opportunityMap.discover,
        create: data.visualData.opportunityMap.create,
        accent,
      })
    );
  }

  if (data.visualData.opportunityMatrix.points.length > 0) {
    const matrixSvg = matrix2x2(
      data.visualData.opportunityMatrix.points.map((p) => ({
        label: p.label,
        x: p.massAudienceExpansion,
        y: p.evidenceStrength,
      })),
      { width: 460, height: 360, xLabel: "Mass Audience Expansion Potential", yLabel: "Evidence Strength" }
    );
    pages.push(
      opportunityMatrixPage({
        breadcrumb: "05 Opportunity",
        reportTitle,
        pageNum: pageNum.n++,
        matrixSvg,
        notes: data.visualData.opportunityMatrix.points.map((p) => ({ label: p.label, note: p.note })),
        accent,
      })
    );
  }

  if (data.visualData.funnel.stages.length > 0) {
    const funnelSvg = funnelChart(data.visualData.funnel.stages, { width: 1080 });
    pages.push(
      audienceFunnelPage({
        breadcrumb: "05 Opportunity",
        reportTitle,
        pageNum: pageNum.n++,
        funnelSvg,
        stages: data.visualData.funnel.stages,
        accent,
      })
    );
  }

  pages.push(...modPages("hidden_value", "05 Strategy"));
  pages.push(...modPages("risk_misperception", "05 Strategy"));
  pages.push(...modPages("positioning_strategy", "05 Strategy"));
  pages.push(...modPages("strategy_actions_ideas", "05 Strategy"));

  if (data.researchReferences.length > 0) {
    pages.push(
      referencePage({
        breadcrumb: "05 Strategy",
        reportTitle,
        pageNum: pageNum.n++,
        refs: data.researchReferences.map((r) => ({ title: r.title, url: r.url, note: r.connectionNote || r.snippet })),
        accent,
      })
    );
  }

  pages.push(backCoverPage({ accent }));

  return `<!DOCTYPE html>
  <html lang="ko"><head><meta charset="utf-8" />
  <style>${fontFaceCss()}${baseStyles(accent)}</style>
  </head><body>${pages.join("\n")}</body></html>`;
}

export async function renderHtmlToPdf(html: string): Promise<Buffer> {
  const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let browser: any;
  if (isServerless) {
    const chromium = (await import("@sparticuz/chromium")).default;
    const puppeteer = await import("puppeteer-core");
    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  } else {
    const puppeteer = await import("puppeteer");
    browser = await puppeteer.default.launch({ headless: true });
  }

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const buffer = await page.pdf({ width: "1280px", height: "720px", printBackground: true });
    return Buffer.from(buffer);
  } finally {
    await browser.close();
  }
}
