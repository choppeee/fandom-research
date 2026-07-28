import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
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
    .select("id, keyword")
    .eq("id", jobId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!job) {
    return NextResponse.json({ error: "Job을 찾을 수 없습니다." }, { status: 404 });
  }

  const admin = createAdminClient();
  const { data: comments } = await admin
    .from("youtube_comments")
    .select("video_id, comment_id, text_original, like_count, published_at")
    .eq("job_id", jobId)
    .order("published_at", { ascending: false });

  const { data: analyses } = await admin
    .from("comment_analysis")
    .select("comment_id, sentiment, purchase_intent, ad_reaction, risk_flag, extracted_keywords, fandom_expressions")
    .eq("job_id", jobId);

  const analysisMap = new Map((analyses ?? []).map((a) => [a.comment_id, a]));

  const header = [
    "video_id",
    "comment_id",
    "published_at",
    "like_count",
    "text_original",
    "sentiment",
    "purchase_intent",
    "ad_reaction",
    "risk_flag",
    "extracted_keywords",
    "fandom_expressions",
  ];

  const rows = (comments ?? []).map((c) => {
    const a = analysisMap.get(c.comment_id);
    return [
      c.video_id,
      c.comment_id,
      c.published_at,
      c.like_count,
      c.text_original,
      a?.sentiment ?? "",
      a?.purchase_intent ?? "",
      a?.ad_reaction ?? "",
      a?.risk_flag ?? "",
      (a?.extracted_keywords ?? []).join("; "),
      (a?.fandom_expressions ?? []).join("; "),
    ]
      .map(csvEscape)
      .join(",");
  });

  const csv = "﻿" + [header.join(","), ...rows].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(job.keyword)}_comments.csv"`,
    },
  });
}
