import fs from "fs";
import path from "path";
import { COLORS, PAGE, accentForKeyword } from "./tokens";
import {
  baseStyles,
  coverPage,
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
  evidencePage,
  header,
  footer,
  chapterBanner,
} from "./pages";
import type { PdfEvidencePackage } from "./evidence-types";
import { barChartHorizontal, donutChart, areaTimelineChart, funnelChart, matrix2x2, bipolarAxisChart } from "./charts";
import { markdownToBlocks, paginateBlocks, stripLeadingHeading } from "./markdown";
import { parseStoredModuleContent } from "../insight-types";
import type { ExecutiveSummaryResult } from "../insight-types";
import type { ValidatedReference } from "../reference-search";
import type { VisualData } from "../visual-data";
import type { Aggregates } from "../aggregate";
import type { ReportMode } from "../report-mode";
import type { MetricItem } from "../report/reportSchema";

export type ModuleContent = { moduleKey: string; title: string; content: string };

export type ReportData = {
  keyword: string;
  periodStart: string;
  periodEnd: string;
  videoCount: number;
  commentCount: number;
  postCount: number;
  generatedAt: string;
  reportMode: ReportMode;
  researchMode?: string;
  // 대표 Evidence로 노출된 콘텐츠와 실제 데이터 커버리지의 차이를 알리는 노트.
  // coverage_audit 태스크가 계산 못했거나(구버전 job) 실패했으면 null.
  dataCoverageNote?: string | null;
  stats: Aggregates;
  modules: ModuleContent[];
  visualData: VisualData;
  researchReferences: ValidatedReference[];
  executiveSummary: ExecutiveSummaryResult;
  // 웹과 동일한 lib/report/ipMetricSelectors.ts의 selectMetrics() 결과. IP 유형에 안 맞거나
  // 실제 계산 근거가 없는 지표(예: 인물 IP의 구매의향)는 여기 애초에 들어있지 않다.
  metrics: MetricItem[];
  // moduleKey별 primary insight(insights[0])의 Evidence Package. 키 형식: `${moduleKey}-0`.
  // PDF export 라우트가 렌더 전에 썸네일/QR까지 다 fetch해서 채워 넣는다(pages.ts는 항상 동기).
  evidenceByInsightId?: Record<string, PdfEvidencePackage>;
  // 레퍼런스 URL -> QR 코드 base64. 마찬가지로 라우트가 미리 생성해서 채운다.
  referenceQrCodes?: Record<string, string>;
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
  chapterIntro?: ChapterIntro,
  evidenceByInsightId?: Record<string, PdfEvidencePackage>
): string[] {
  if (!mod || !mod.content.trim()) return [];
  const parsed = parseStoredModuleContent(mod.content);

  if (parsed && parsed.kind === "insights") {
    const r = parsed.data;
    if (!r.applicable && r.insights.length === 0) {
      // 적용 어려움 - 데이터 없는 페이지를 억지로 넣지 않고 건너뛴다.
      return [];
    }
    const pages = [
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
    // 핵심(primary) insight에 실제 원본 영상/댓글 근거가 있으면, 바로 다음 장에 Evidence 페이지를 덧붙인다.
    // no_visual이면(근거가 통계뿐이면) 페이지를 만들지 않는다 - 시각자료를 억지로 채우지 않는다.
    const evidencePkg = evidenceByInsightId?.[`${mod.moduleKey}-0`];
    if (evidencePkg && evidencePkg.visualRecommendation !== "no_visual" && r.insights[0]) {
      pages.push(
        evidencePage({
          breadcrumb,
          reportTitle,
          pageNum: pageNumRef.n++,
          insightHeadline: r.insights[0].headline,
          pkg: evidencePkg,
          accent,
        })
      );
    }
    return pages;
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
    renderModulePages(byKey.get(key), breadcrumb, reportTitle, accent, pageNum, chapterIntro, data.evidenceByInsightId);

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
  // 핵심 지표(KPI)만 놓고 아래 절반이 비는 페이지를 따로 두지 않고, Top 5 발견과
  // 한 페이지로 합쳐서 "지표를 보자마자 근거로 이어지는" 하나의 Executive 페이지로 만든다.
  const kpiDisclaimer =
    data.researchMode === "single_content"
      ? `REPORT SCOPE: Single Content Analysis — 이 리포트는 입력한 영상 1개와 그 댓글만을 근거로 합니다. LIMITATION: 이 결과는 입력한 영상과 해당 댓글에 한정됩니다.`
      : [
          data.reportMode === "exploratory"
            ? `표본이 ${data.videoCount + data.postCount}건의 콘텐츠, ${data.commentCount + data.postCount}건의 반응으로 작습니다. 이 리포트는 전체 ${data.keyword}에 대한 확정적 진단이 아니라, 현재 표본에서 발견된 반응 후보를 다룹니다.`
            : null,
          data.dataCoverageNote ? `DATA COVERAGE — ${data.dataCoverageNote}` : null,
        ]
          .filter(Boolean)
          .join(" ") || undefined;

  if (data.metrics.length > 0 || data.executiveSummary.findings.length > 0) {
    pages.push(
      execSummaryCardsPage({
        breadcrumb: "01 Executive",
        reportTitle,
        pageNum: pageNum.n++,
        findings: data.executiveSummary.findings,
        accent,
        kpis: data.metrics.map((m) => ({ label: m.label, value: m.value })),
        kpiDisclaimer,
      })
    );
  }

  const glance = data.executiveSummary.ipAtGlance;
  const glanceSteps = [
    ...(data.executiveSummary.currentSituation ? [{ label: "CURRENT SITUATION", value: data.executiveSummary.currentSituation }] : []),
    { label: "CURRENT PRIORITY", value: glance.currentPosition },
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

  const contentWidth = PAGE.width - PAGE.marginX * 2;
  const donutSvg = donutChart(
    [
      { label: "긍정", value: data.stats.sentimentRatio.positive, color: COLORS.positive },
      { label: "부정", value: data.stats.sentimentRatio.negative, color: COLORS.risk },
      { label: "중립", value: data.stats.sentimentRatio.neutral, color: COLORS.neutralChart },
    ],
    { size: 140 }
  );
  const keywordSvg = barChartHorizontal(
    data.stats.topKeywords.slice(0, 8).map((k) => ({ label: k.keyword, value: k.count })),
    { width: contentWidth - 140 - 20, color: accent }
  );
  const timelineSvg = areaTimelineChart(data.stats.dailyTrend, { width: contentWidth, height: 160, color: accent });
  pages.push(`<section class="page">
    ${header("02 Audience")}
    ${chapterBanner({ ...chapter02, accent })}
    <h2 style="font-size:19px;margin-top:10px;margin-bottom:16px;">감성·주제 분포</h2>
    <div style="display:flex;gap:20px;align-items:flex-start;">
      <div>${donutSvg}</div>
      <div>${keywordSvg}</div>
    </div>
    <div style="margin-top:16px;">
      <div style="font-size:10.5px;color:#686371;margin-bottom:8px;">언급량 · 참여량 추이</div>
      ${timelineSvg}
    </div>
    ${footer(reportTitle, pageNum.n++)}
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
      { width: contentWidth, color: accent }
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
  const { strongAssets, hiddenAssets, weakSignals, risks } = data.visualData.diagnostic;
  // 유효 항목이 하나도 없으면 4칸 전부 "데이터 부족"인 빈 대시보드 페이지를 만들지 않는다.
  if (strongAssets.length + hiddenAssets.length + weakSignals.length + risks.length > 0) {
    pages.push(
      diagnosticDashboardPage({
        breadcrumb: "04 Diagnosis",
        reportTitle,
        pageNum: pageNum.n++,
        chapterIntro: chapter04,
        strong: strongAssets,
        hidden: hiddenAssets,
        weak: weakSignals,
        risks: risks,
        accent,
      })
    );
    chapter04 = undefined;
  }
  pages.push(...modPages("hidden_value", "04 Diagnosis"));
  pages.push(...modPages("risk_misperception", "04 Diagnosis"));

  // --- 05 OPPORTUNITY ---
  // 유지·발견·창조 카드가 카테고리 하나에 1~2개만 있으면 그것만으로 페이지 아래 절반이 늘
  // 비었다 - 매트릭스가 있으면 같은 페이지에 이어 붙여 밀도를 높이고, 매트릭스가 없을 때만
  // 별도 페이지로 둔다.
  const hasOpportunityMap =
    data.visualData.opportunityMap.keep.length +
      data.visualData.opportunityMap.discover.length +
      data.visualData.opportunityMap.create.length >
    0;
  const hasOpportunityMatrix = data.visualData.opportunityMatrix.points.length > 0;
  const hasFunnel = data.visualData.funnel.stages.length > 0;
  const funnelParam = hasFunnel
    ? {
        funnelSvg: funnelChart(data.visualData.funnel.stages, { width: contentWidth, color: accent }),
        stages: data.visualData.funnel.stages,
      }
    : undefined;

  if (hasOpportunityMatrix) {
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
        opportunityMap: hasOpportunityMap ? data.visualData.opportunityMap : undefined,
        funnel: funnelParam,
      })
    );
  } else if (hasOpportunityMap) {
    pages.push(
      opportunityMapPage({
        breadcrumb: "05 Opportunity",
        reportTitle,
        pageNum: pageNum.n++,
        keep: data.visualData.opportunityMap.keep,
        discover: data.visualData.opportunityMap.discover,
        create: data.visualData.opportunityMap.create,
        accent,
        funnel: funnelParam,
      })
    );
  } else if (hasFunnel && funnelParam) {
    pages.push(
      audienceFunnelPage({
        breadcrumb: "05 Opportunity",
        reportTitle,
        pageNum: pageNum.n++,
        funnelSvg: funnelParam.funnelSvg,
        stages: funnelParam.stages,
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
        academic: academic.map((r) => ({ title: r.title, url: r.url, note: r.connectionNote || r.snippet, qrDataUri: data.referenceQrCodes?.[r.url] })),
        context: context.map((r) => ({ title: r.title, url: r.url, note: r.connectionNote || r.snippet, qrDataUri: data.referenceQrCodes?.[r.url] })),
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

// @sparticuz/chromium은 최초 호출 시 압축된 바이너리를 /tmp에 풀어서 캐시한다. 같은(웜) 서버리스
// 컨테이너에서 두 요청이 동시에 들어오면 executablePath()를 둘 다 새로 호출해 같은 파일에 동시에
// 쓰려다 "spawn ETXTBSY"(파일이 아직 쓰는 중이라 실행 불가)로 실패하는 경우가 실측 확인됐다.
// 컨테이너당 한 번만 추출하고 이후 호출은 같은 Promise를 공유해 경합을 없앤다.
let chromiumExecutablePathPromise: Promise<string> | null = null;

export async function renderHtmlToPdf(html: string): Promise<Buffer> {
  const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let browser: any;
  if (isServerless) {
    const chromium = (await import("@sparticuz/chromium")).default;
    const puppeteer = await import("puppeteer-core");
    if (!chromiumExecutablePathPromise) {
      chromiumExecutablePathPromise = chromium.executablePath();
    }
    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromiumExecutablePathPromise,
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
    // A4 세로. .page 블록은 min-height만 갖고 자연스럽게 흐르므로(padding은 각 .page가 스스로
    // 관리), 여기 margin은 0으로 둔다 - 이중 여백을 방지한다.
    const buffer = await page.pdf({
      format: "a4",
      printBackground: true,
      margin: { top: "0", bottom: "0", left: "0", right: "0" },
    });
    return Buffer.from(buffer);
  } finally {
    await browser.close();
  }
}
