import fs from "fs";
import path from "path";
import { COLORS, accentForKeyword } from "./tokens";
import {
  baseStyles,
  coverPage,
  kpiDashboardPage,
  execSummaryCardsPage,
  ipAtGlancePage,
  insightModulePage,
  legacyTextPage,
  diagnosticDashboardPage,
  audienceFunnelPage,
  characterArchitecturePage,
  opportunityMatrixPage,
  perceptionMapPage,
  opportunityMapPage,
  positioningPage,
  strategyPage,
  referencePage,
  backCoverPage,
} from "./pages";
import { barChartHorizontal, donutChart, areaTimelineChart, funnelChart, matrix2x2, bipolarAxisChart } from "./charts";
import { markdownToBlocks, paginateBlocks, stripLeadingHeading } from "./markdown";
import { parseStoredModuleContent } from "../insight-types";
import type { ExecutiveSummaryResult } from "../insight-types";
import type { ValidatedReference } from "../reference-search";
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
  researchReferences: ValidatedReference[];
  executiveSummary: ExecutiveSummaryResult;
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

type ChapterIntro = { num: string; title: string; keyQuestion: string };

/** 신규 구조화 모듈(insights)이면 Insight Page 1장, 구버전 자유 마크다운이면 레거시 페이지(여러 장 가능)로 렌더링. */
function renderModulePages(
  mod: ModuleContent | undefined,
  breadcrumb: string,
  reportTitle: string,
  accent: string,
  pageNumRef: { n: number },
  chapterIntro?: ChapterIntro
): string[] {
  if (!mod || !mod.content.trim()) return [];
  const parsed = parseStoredModuleContent(mod.content);

  if (parsed && parsed.kind === "insights") {
    const r = parsed.data;
    if (!r.applicable && r.insights.length === 0) {
      // 적용 어려움 - 데이터 없는 페이지를 억지로 넣지 않고 건너뛴다.
      return [];
    }
    return [
      insightModulePage({
        breadcrumb,
        reportTitle,
        pageNum: pageNumRef.n++,
        chapterIntro,
        moduleTitle: mod.title,
        applicable: r.applicable,
        notApplicableReason: r.notApplicableReason,
        primary: r.insights[0],
        secondary: r.insights.slice(1),
        accent,
      }),
    ];
  }

  // 레거시 자유 마크다운 폴백 (구버전 job과의 하위호환)
  const blocks = markdownToBlocks(stripLeadingHeading(mod.content));
  const pageGroups = paginateBlocks(blocks, 200);
  return pageGroups.map((group, i) =>
    legacyTextPage({
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

  const byKey = new Map(data.modules.map((m) => [m.moduleKey, m]));
  const modPages = (key: string, breadcrumb: string, chapterIntro?: ChapterIntro) =>
    renderModulePages(byKey.get(key), breadcrumb, reportTitle, accent, pageNum, chapterIntro);

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
      topKeywords: data.stats.topKeywords,
      accent,
    })
  );
  pageNum.n++;

  // --- 01 EXECUTIVE ---
  pages.push(
    kpiDashboardPage({
      breadcrumb: "01 Executive",
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

  if (data.executiveSummary.findings.length > 0) {
    pages.push(
      execSummaryCardsPage({
        breadcrumb: "01 Executive",
        reportTitle,
        pageNum: pageNum.n++,
        findings: data.executiveSummary.findings,
        accent,
      })
    );
  }

  const glance = data.executiveSummary.ipAtGlance;
  const glanceSteps = [
    { label: "CURRENT POSITION", value: glance.currentPosition },
    { label: "CORE APPEAL", value: glance.coreAppeal },
    { label: "HIDDEN VALUE", value: glance.hiddenValue },
    { label: "TOP OPPORTUNITY", value: glance.topOpportunity },
    { label: "TOP RISK", value: glance.topRisk },
    { label: "RECOMMENDED DIRECTION", value: glance.recommendedDirection },
  ].filter((s) => s.value.trim());
  if (glanceSteps.length > 0) {
    pages.push(
      ipAtGlancePage({
        breadcrumb: "01 Executive",
        reportTitle,
        pageNum: pageNum.n++,
        steps: glanceSteps,
        finalSentence: data.executiveSummary.finalSentence,
        accent,
      })
    );
  }

  // --- 02 AUDIENCE ---
  // 데이터 시각화 페이지는 통계에서 직접 계산되어 항상 렌더링되므로, 챕터 배너를 여기 고정 부착한다
  // (LLM 모듈은 이번 데이터/IP에 적용 불가능할 경우 페이지 자체가 생략될 수 있어 배너 앵커로 쓰지 않는다).
  const chapter02: ChapterIntro = { num: "02", title: "AUDIENCE", keyQuestion: "누가, 왜 반응하는가?" };

  const donutSvg = donutChart(
    [
      { label: "긍정", value: data.stats.sentimentRatio.positive, color: COLORS.positive },
      { label: "부정", value: data.stats.sentimentRatio.negative, color: COLORS.risk },
      { label: "중립", value: data.stats.sentimentRatio.neutral, color: COLORS.neutralChart },
    ],
    { size: 170 }
  );
  const keywordSvg = barChartHorizontal(
    data.stats.topKeywords.slice(0, 8).map((k) => ({ label: k.keyword, value: k.count })),
    { width: 440, color: accent }
  );
  const timelineSvg = areaTimelineChart(data.stats.dailyTrend, { width: 1080, height: 190, color: accent });
  pages.push(`<section class="page" style="padding:56px;">
    <div class="header"><div style="display:flex;align-items:center;gap:12px;"><div class="dash"></div><span style="font-size:10.5px;color:#686371;">02 Audience</span></div><span class="brand">FANDOM RESEARCH</span></div>
    <div style="margin-top:58px;margin-bottom:6px;display:flex;align-items:baseline;gap:14px;"><span style="font-size:13px;font-weight:700;color:${accent};letter-spacing:0.5px;">${chapter02.num} ${chapter02.title}</span><span style="font-size:11px;color:#8A8594;">${chapter02.keyQuestion}</span></div>
    <h2 style="font-size:22px;margin-top:10px;margin-bottom:20px;">SENTIMENT &amp; TOPIC DISTRIBUTION</h2>
    <div style="display:flex;gap:36px;align-items:flex-start;">
      <div>${donutSvg}</div>
      <div>${keywordSvg}</div>
    </div>
    <div style="margin-top:18px;">
      <div style="font-size:10.5px;color:#686371;margin-bottom:8px;">언급량 · 참여량 추이</div>
      ${timelineSvg}
    </div>
    <div class="footer"><span>${reportTitle}</span><span>${pageNum.n++}</span></div>
  </section>`);

  pages.push(...modPages("audience_segments", "02 Audience"));
  pages.push(...modPages("conversion_signals", "02 Audience"));

  // --- 03 IP PERCEPTION ---
  let chapter03: ChapterIntro | undefined = { num: "03", title: "IP PERCEPTION", keyQuestion: "대중 인식의 구조는 어떤가?" };
  const consumeChapter03 = () => {
    const c = chapter03;
    chapter03 = undefined;
    return c;
  };
  pages.push(...modPages("audience_perception", "03 Perception", consumeChapter03()));

  if (data.visualData.perceptionMap.axes.length > 0) {
    const axisSvg = bipolarAxisChart(
      data.visualData.perceptionMap.axes.map((a) => ({ leftLabel: a.leftLabel, rightLabel: a.rightLabel, position: a.position })),
      { width: 900, color: accent }
    );
    pages.push(
      perceptionMapPage({
        breadcrumb: "03 Perception",
        reportTitle,
        pageNum: pageNum.n++,
        chapterIntro: consumeChapter03(),
        axisSvg,
        accent,
      })
    );
  }

  if (data.visualData.characterArchitecture.applicable && data.visualData.characterArchitecture.layers.length > 0) {
    pages.push(
      characterArchitecturePage({
        breadcrumb: "03 Perception",
        reportTitle,
        pageNum: pageNum.n++,
        ipLabel: data.visualData.ipLabel,
        layers: data.visualData.characterArchitecture.layers,
        accent,
      })
    );
  }
  pages.push(...modPages("character_traits", "03 Perception", consumeChapter03()));
  pages.push(...modPages("appeal_drivers", "03 Perception"));
  pages.push(...modPages("relationship_dynamics", "03 Perception"));
  pages.push(...modPages("viral_mechanics", "03 Perception"));
  pages.push(...modPages("platform_youtube", "03 Perception"));
  pages.push(...modPages("platform_x", "03 Perception"));
  pages.push(...modPages("cross_platform", "03 Perception"));

  // --- 04 DIAGNOSIS ---
  let chapter04: ChapterIntro | undefined = { num: "04", title: "DIAGNOSIS", keyQuestion: "무엇이 강점이고 무엇이 위험인가?" };
  pages.push(
    diagnosticDashboardPage({
      breadcrumb: "04 Diagnosis",
      reportTitle,
      pageNum: pageNum.n++,
      chapterIntro: chapter04,
      strong: data.visualData.diagnostic.strongAssets,
      hidden: data.visualData.diagnostic.hiddenAssets,
      weak: data.visualData.diagnostic.weakSignals,
      risks: data.visualData.diagnostic.risks,
      accent,
    })
  );
  chapter04 = undefined;
  pages.push(...modPages("hidden_value", "04 Diagnosis"));
  pages.push(...modPages("risk_misperception", "04 Diagnosis"));

  // --- 05 OPPORTUNITY ---
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
    const points = data.visualData.opportunityMatrix.points;
    const matrixSvg = matrix2x2(
      points.map((p) => ({ x: p.massAudienceExpansion, y: p.evidenceStrength, color: accent })),
      {
        width: 440,
        height: 340,
        xLabel: "Mass Audience Expansion Potential",
        yLabel: "Evidence Strength",
        quadrants: { topRight: "PRIORITIZE", topLeft: "PROTECT", bottomRight: "TEST", bottomLeft: "DEPRIORITIZE" },
      }
    );
    pages.push(
      opportunityMatrixPage({
        breadcrumb: "05 Opportunity",
        reportTitle,
        pageNum: pageNum.n++,
        matrixSvg,
        notes: points.map((p) => ({ label: p.label, note: p.note })),
        accent,
      })
    );
  }

  if (data.visualData.funnel.stages.length > 0) {
    const funnelSvg = funnelChart(data.visualData.funnel.stages, { width: 1080, color: accent });
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

  const positioningMod = byKey.get("positioning_strategy");
  if (positioningMod) {
    const parsed = parseStoredModuleContent(positioningMod.content);
    if (parsed && parsed.kind === "positioning" && parsed.data.candidates.length > 0) {
      pages.push(
        positioningPage({
          breadcrumb: "05 Opportunity",
          reportTitle,
          pageNum: pageNum.n++,
          candidates: parsed.data.candidates,
          core: parsed.data.core,
          supporting: parsed.data.supporting,
          emerging: parsed.data.emerging,
          accent,
        })
      );
    }
  }

  // --- 06 STRATEGY ---
  const strategyMod = byKey.get("strategy_actions_ideas");
  if (strategyMod) {
    const parsed = parseStoredModuleContent(strategyMod.content);
    if (parsed && parsed.kind === "strategy" && parsed.data.recommendations.length > 0) {
      pages.push(
        strategyPage({
          breadcrumb: "06 Strategy",
          reportTitle,
          pageNum: pageNum.n++,
          recommendations: parsed.data.recommendations,
          appendixIdeas: parsed.data.appendixIdeas,
          accent,
        })
      );
    }
  }

  // --- 07 REFERENCES & EVIDENCE ---
  if (data.researchReferences.length > 0) {
    const academic = data.researchReferences.filter((r) => r.category === "academic");
    const context = data.researchReferences.filter((r) => r.category !== "academic");
    pages.push(
      referencePage({
        breadcrumb: "07 References",
        reportTitle,
        pageNum: pageNum.n++,
        academic: academic.map((r) => ({ title: r.title, url: r.url, note: r.connectionNote || r.snippet })),
        context: context.map((r) => ({ title: r.title, url: r.url, note: r.connectionNote || r.snippet })),
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
    // Puppeteer의 기본 30초 네비게이션 타임아웃은 서버리스 콜드 스타트 + 대용량 base64 폰트
    // 임베드 상황에서 부족할 수 있어, 라우트의 maxDuration(90s) 안에서 여유있게 늘린다.
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 60_000 });
    const buffer = await page.pdf({ width: "1280px", height: "720px", printBackground: true });
    return Buffer.from(buffer);
  } finally {
    await browser.close();
  }
}
