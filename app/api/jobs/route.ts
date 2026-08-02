import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const DEFAULT_MAX_VIDEOS = 20;
const DEFAULT_MAX_COMMENTS = 30;
const HARD_MAX_VIDEOS = 200;
const HARD_MAX_COMMENTS = 200;
const HARD_MAX_COMMENTS_SINGLE = 500;
const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const researchMode = body?.researchMode === "single_content" ? "single_content" : "broad_research";

  if (researchMode === "single_content") {
    const sourceType = String(body?.sourceType ?? "");
    const sourceUrl = String(body?.sourceUrl ?? "");
    const sourceId = String(body?.sourceId ?? "");
    const sourceMetadata = body?.sourceMetadata ?? null;
    const maxCommentsPerVideo = Math.min(
      HARD_MAX_COMMENTS_SINGLE,
      Number(body?.maxCommentsPerVideo) || DEFAULT_MAX_COMMENTS
    );

    if (sourceType !== "youtube_video" || !YOUTUBE_VIDEO_ID_PATTERN.test(sourceId)) {
      return NextResponse.json({ error: "유효한 영상 링크를 먼저 확인해주세요." }, { status: 400 });
    }

    const { data: existing } = await supabase
      .from("research_jobs")
      .select("id, status")
      .eq("user_id", user.id)
      .eq("research_mode", "single_content")
      .eq("source_id", sourceId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ jobId: existing.id, status: existing.status, reused: true });
    }

    const title = typeof sourceMetadata?.title === "string" ? sourceMetadata.title : sourceId;
    const today = new Date().toISOString().slice(0, 10);

    const { data: created, error } = await supabase
      .from("research_jobs")
      .insert({
        user_id: user.id,
        keyword: title.slice(0, 200), // 목록/중복검사 등 keyword 기반 기존 로직과 호환되도록 영상 제목을 채움
        period_start: today,
        period_end: today,
        max_videos: 1,
        max_comments_per_video: maxCommentsPerVideo,
        status: "pending",
        research_mode: "single_content",
        source_type: sourceType,
        source_url: sourceUrl,
        source_id: sourceId,
        source_metadata: sourceMetadata,
      })
      .select("id, status")
      .single();

    if (error || !created) {
      return NextResponse.json({ error: `Job 생성 실패: ${error?.message ?? "알 수 없는 오류"}` }, { status: 500 });
    }

    return NextResponse.json({ jobId: created.id, status: created.status, reused: false });
  }

  const keyword = String(body?.keyword ?? "").trim();
  const periodStart = String(body?.periodStart ?? "");
  const periodEnd = String(body?.periodEnd ?? "");
  const maxVideos = Math.min(
    HARD_MAX_VIDEOS,
    Number(body?.maxVideos) || DEFAULT_MAX_VIDEOS
  );
  const maxCommentsPerVideo = Math.min(
    HARD_MAX_COMMENTS,
    Number(body?.maxCommentsPerVideo) || DEFAULT_MAX_COMMENTS
  );

  if (!keyword) {
    return NextResponse.json({ error: "키워드를 입력해주세요." }, { status: 400 });
  }
  if (!periodStart || !periodEnd || periodStart > periodEnd) {
    return NextResponse.json({ error: "분석 기간이 올바르지 않습니다." }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("research_jobs")
    .select("id, status")
    .eq("user_id", user.id)
    .eq("keyword", keyword)
    .eq("period_start", periodStart)
    .eq("period_end", periodEnd)
    .eq("research_mode", "broad_research")
    .maybeSingle();

  if (existing) {
    return NextResponse.json({
      jobId: existing.id,
      status: existing.status,
      reused: true,
    });
  }

  const { data: created, error } = await supabase
    .from("research_jobs")
    .insert({
      user_id: user.id,
      keyword,
      period_start: periodStart,
      period_end: periodEnd,
      max_videos: maxVideos,
      max_comments_per_video: maxCommentsPerVideo,
      status: "pending",
      research_mode: "broad_research",
    })
    .select("id, status")
    .single();

  if (error || !created) {
    return NextResponse.json(
      { error: `Job 생성 실패: ${error?.message ?? "알 수 없는 오류"}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    jobId: created.id,
    status: created.status,
    reused: false,
  });
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("research_jobs")
    .select("id, keyword, period_start, period_end, status, progress, created_at, research_mode")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ jobs: data ?? [] });
}
