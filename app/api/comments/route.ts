import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

const PAGE_SIZE = 20;

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId");
  const sentiment = searchParams.get("sentiment");
  const q = searchParams.get("q")?.trim();
  const page = Math.max(1, Number(searchParams.get("page")) || 1);

  if (!jobId) {
    return NextResponse.json({ error: "jobId가 필요합니다." }, { status: 400 });
  }

  const { data: job } = await supabase
    .from("research_jobs")
    .select("id")
    .eq("id", jobId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!job) {
    return NextResponse.json({ error: "Job을 찾을 수 없습니다." }, { status: 404 });
  }

  const admin = createAdminClient();

  let commentIdFilter: string[] | null = null;
  if (sentiment && sentiment !== "all") {
    const { data: filtered } = await admin
      .from("comment_analysis")
      .select("comment_id")
      .eq("job_id", jobId)
      .eq("sentiment", sentiment);
    commentIdFilter = (filtered ?? []).map((r) => r.comment_id);
    if (commentIdFilter.length === 0) {
      return NextResponse.json({ comments: [], total: 0, page, pageSize: PAGE_SIZE });
    }
  }

  const offset = (page - 1) * PAGE_SIZE;
  let query = admin
    .from("youtube_comments")
    .select("comment_id, video_id, text_original, like_count, published_at", { count: "exact" })
    .eq("job_id", jobId);

  if (commentIdFilter) query = query.in("comment_id", commentIdFilter);
  if (q) query = query.ilike("text_original", `%${q}%`);

  const { data: comments, count, error } = await query
    .order("published_at", { ascending: false, nullsFirst: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const ids = (comments ?? []).map((c) => c.comment_id);
  const { data: analyses } = ids.length
    ? await admin
        .from("comment_analysis")
        .select("comment_id, sentiment, purchase_intent, risk_flag, extracted_keywords, fandom_expressions")
        .in("comment_id", ids)
    : { data: [] };

  const analysisMap = new Map((analyses ?? []).map((a) => [a.comment_id, a]));

  const result = (comments ?? []).map((c) => ({
    commentId: c.comment_id,
    videoId: c.video_id,
    text: c.text_original,
    likeCount: c.like_count,
    publishedAt: c.published_at,
    analysis: analysisMap.get(c.comment_id) ?? null,
  }));

  return NextResponse.json({ comments: result, total: count ?? 0, page, pageSize: PAGE_SIZE });
}
