import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { findAdapterForUrl } from "@/lib/social/registry";

// 콘텐츠 하나(YouTube 영상/Instagram 게시물·릴스)는 "single_content" 리포트 범위 제약을 그대로
// 재사용한다 - 채널/프로필/업로드 데이터셋처럼 여러 콘텐츠를 다루는 소스는 "broad_research"로
// 취급해 기존 리포트 스코프 로직(insight-types/buildReportModel/pdf render 등)을 그대로 탄다.
const SINGLE_ITEM_SOURCE_TYPES = new Set(["youtube_video", "instagram_post", "instagram_reel"]);
const DEFAULT_MAX_ITEMS = 60;
const HARD_MAX_ITEMS = 500;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const url = String(body?.url ?? "").trim();
  const maxItems = Math.min(HARD_MAX_ITEMS, Number(body?.maxItems) || DEFAULT_MAX_ITEMS);
  if (!url) {
    return NextResponse.json({ error: "링크를 입력해주세요." }, { status: 400 });
  }

  const adapter = findAdapterForUrl(url);
  if (!adapter) {
    return NextResponse.json(
      {
        error: {
          code: "not_supported_yet",
          message: "아직 지원하지 않는 링크 형식입니다. YouTube 영상/채널, Instagram 게시물·릴스·프로필 링크를 입력해주세요.",
        },
      },
      { status: 400 }
    );
  }

  const resolved = await adapter.resolve(url, { userId: user.id });
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: 400 });
  }
  const source = resolved.source;

  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);
  const title =
    (typeof source.metadata?.title === "string" && source.metadata.title) ||
    (typeof source.metadata?.username === "string" && `@${source.metadata.username}`) ||
    source.sourceUrl;
  const researchMode = SINGLE_ITEM_SOURCE_TYPES.has(source.sourceType) ? "single_content" : "broad_research";

  const { data: job, error: jobError } = await admin
    .from("research_jobs")
    .insert({
      user_id: user.id,
      keyword: String(title).slice(0, 200),
      period_start: today,
      period_end: today,
      max_videos: 1,
      max_comments_per_video: maxItems,
      status: "pending",
      research_mode: researchMode,
      source_type: source.sourceType,
      source_url: source.sourceUrl,
      source_id: source.sourceId,
      source_metadata: source.metadata,
      uses_common_schema: true,
    })
    .select("id, status")
    .single();

  if (jobError || !job) {
    return NextResponse.json({ error: `Job 생성 실패: ${jobError?.message ?? "알 수 없는 오류"}` }, { status: 500 });
  }

  const { error: sourceError } = await admin.from("sources").insert({
    job_id: job.id,
    platform: source.platform,
    source_type: source.sourceType,
    source_url: source.sourceUrl,
    external_id: source.sourceId,
    data_origin: source.dataOrigin,
    account_connection_id: (source.metadata.connectionId as string | undefined) ?? null,
    metadata: source.metadata,
    availability: null,
  });

  if (sourceError) {
    // 절반만 만들어진 job이 남지 않도록 롤백한다.
    await admin.from("research_jobs").delete().eq("id", job.id);
    return NextResponse.json({ error: `소스 저장 실패: ${sourceError.message}` }, { status: 500 });
  }

  return NextResponse.json({
    jobId: job.id,
    status: job.status,
    sourceType: source.sourceType,
    connectionStatus: source.connectionStatus,
    dataOrigin: source.dataOrigin,
  });
}
