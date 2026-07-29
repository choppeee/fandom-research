import { NextRequest, NextResponse } from "next/server";
import path from "path";
import PDFDocument from "pdfkit";
import { createClient, createAdminClient } from "@/lib/supabase/server";

const FONT_REGULAR = path.join(process.cwd(), "assets/fonts/NanumGothic-Regular.ttf");
const FONT_BOLD = path.join(process.cwd(), "assets/fonts/NanumGothic-Bold.ttf");

/** 마크다운 리포트를 pdfkit으로 대략적으로 옮긴다 (헤딩/목록 구분, 인라인 서식은 기호만 제거). */
function renderMarkdownToPdf(doc: PDFKit.PDFDocument, markdown: string) {
  const stripInline = (s: string) =>
    s
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/`(.+?)`/g, "$1")
      .replace(/\[(.+?)\]\((.+?)\)/g, "$1 ($2)");

  for (const rawLine of markdown.split("\n")) {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      doc.moveDown(0.4);
      continue;
    }
    if (line.startsWith("## ")) {
      doc.moveDown(0.5);
      doc.font("heading").fontSize(14).text(stripInline(line.slice(3)));
      continue;
    }
    if (line.startsWith("### ")) {
      doc.moveDown(0.3);
      doc.font("heading").fontSize(12).text(stripInline(line.slice(4)));
      continue;
    }
    if (/^[-*]\s+/.test(line.trim())) {
      doc.font("body").fontSize(10).text(`•  ${stripInline(line.trim().replace(/^[-*]\s+/, ""))}`, {
        indent: 12,
      });
      continue;
    }
    if (line.startsWith("|")) {
      // 표는 pdfkit에서 정확히 재현하지 않고 셀을 구분자로 이어붙여 표시한다
      const cells = line.split("|").map((c) => c.trim()).filter(Boolean);
      if (cells.every((c) => /^-+$/.test(c))) continue;
      doc.font("body").fontSize(9).text(cells.join("  |  "));
      continue;
    }
    doc.font("body").fontSize(10).text(stripInline(line));
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { data: job } = await supabase
    .from("research_jobs")
    .select("id, keyword, period_start, period_end")
    .eq("id", jobId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!job) {
    return NextResponse.json({ error: "Job을 찾을 수 없습니다." }, { status: 404 });
  }

  const admin = createAdminClient();
  const { data: insight } = await admin
    .from("job_insights")
    .select(
      "summary_text, top_keywords, sentiment_ratio, fandom_highlights, purchase_intent_summary, risk_alerts, generated_at"
    )
    .eq("job_id", jobId)
    .maybeSingle();
  const { count: videoCount } = await admin
    .from("youtube_videos")
    .select("id", { count: "exact", head: true })
    .eq("job_id", jobId);
  const { count: commentCount } = await admin
    .from("youtube_comments")
    .select("id", { count: "exact", head: true })
    .eq("job_id", jobId);

  const doc = new PDFDocument({ margin: 50 });
  doc.registerFont("body", FONT_REGULAR);
  doc.registerFont("heading", FONT_BOLD);

  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  doc.font("heading").fontSize(20).text("팬덤 리서치 리포트", { align: "center" });
  doc.moveDown();
  doc.font("heading").fontSize(14).text(`키워드: ${job.keyword}`);
  doc.font("body").fontSize(11).text(`분석 기간: ${job.period_start} ~ ${job.period_end}`);
  doc.text(`영상 ${videoCount ?? 0}개 · 댓글 ${commentCount ?? 0}개`);
  if (insight?.generated_at) {
    doc.text(`생성일: ${new Date(insight.generated_at).toLocaleString("ko-KR")}`);
  }
  doc.moveDown();

  if (!insight) {
    doc.font("body").fontSize(11).text("분석 결과가 없습니다.");
  } else {
    doc.font("heading").fontSize(16).text("IP 인텔리전스 리포트");
    doc.moveDown(0.5);
    renderMarkdownToPdf(doc, insight.summary_text ?? "");
    doc.moveDown();

    doc.font("heading").fontSize(14).text("감성 비율");
    const sr = insight.sentiment_ratio as { positive: number; negative: number; neutral: number };
    doc.font("body").fontSize(11).text(`긍정 ${sr?.positive ?? 0}% · 부정 ${sr?.negative ?? 0}% · 중립 ${sr?.neutral ?? 0}%`);
    doc.moveDown();

    doc.font("heading").fontSize(14).text("연관 키워드 Top 10");
    const topKeywords = (insight.top_keywords as { keyword: string; count: number }[]) ?? [];
    doc.font("body").fontSize(11).text(
      topKeywords.slice(0, 10).map((k) => `${k.keyword}(${k.count})`).join(", ") || "-"
    );
    doc.moveDown();

    doc.font("heading").fontSize(14).text("팬덤 표현·밈 하이라이트");
    const fandom = (insight.fandom_highlights as { expression: string; count: number; example: string }[]) ?? [];
    if (fandom.length === 0) {
      doc.font("body").fontSize(11).text("-");
    } else {
      for (const f of fandom.slice(0, 5)) {
        doc.font("body").fontSize(11).text(`- "${f.expression}" (${f.count}회): ${f.example}`);
      }
    }
    doc.moveDown();

    doc.font("heading").fontSize(14).text("구매의향/광고반응");
    const pi = insight.purchase_intent_summary as { positiveRatio: number; examples: string[] };
    doc.font("body").fontSize(11).text(`긍정 구매의향 비율: ${pi?.positiveRatio ?? 0}%`);
    doc.moveDown();

    doc.font("heading").fontSize(14).text("이슈·위험 탐지");
    const risks = (insight.risk_alerts as { level: string; description: string }[]) ?? [];
    if (risks.length === 0) {
      doc.font("body").fontSize(11).text("감지된 위험 신호가 없습니다.");
    } else {
      for (const r of risks) {
        doc.font("body").fontSize(11).text(`- [${r.level === "high_risk" ? "고위험" : "주의"}] ${r.description}`);
      }
    }
  }

  doc.moveDown(2);
  doc
    .font("body")
    .fontSize(8)
    .fillColor("#888888")
    .text(
      "본 리포트는 AI 분석 추정치를 포함하며, 원문 인용은 출처(유튜브 영상) 확인을 위한 소량 예시입니다.",
      { align: "left" }
    );

  doc.end();
  const buffer = await done;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(job.keyword)}_report.pdf"`,
    },
  });
}
