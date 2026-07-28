import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { searchVideoIds, getVideoDetails, getVideoComments } from "@/lib/youtube";
import { analyzeCommentBatch, generateJobInsight, COMMENT_BATCH_SIZE } from "@/lib/claude";
import { computeAggregates, type CommentRow } from "@/lib/aggregate";

export const maxDuration = 300;

type Job = {
  id: string;
  keyword: string;
  period_start: string;
  period_end: string;
  max_videos: number;
  max_comments_per_video: number;
  status: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function setJobState(admin: any, jobId: string, patch: Record<string, unknown>) {
  await admin
    .from("research_jobs")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", jobId);
}

export async function POST(
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
    .select("id, keyword, period_start, period_end, max_videos, max_comments_per_video, status")
    .eq("id", jobId)
    .eq("user_id", user.id)
    .maybeSingle<Job>();

  if (!job) {
    return NextResponse.json({ error: "Job을 찾을 수 없습니다." }, { status: 404 });
  }
  if (!["pending", "failed"].includes(job.status)) {
    return NextResponse.json({ jobId: job.id, status: job.status, skipped: true });
  }

  const admin = createAdminClient();

  try {
    // 1. 영상 수집
    await setJobState(admin, jobId, { status: "collecting_videos", progress: 5, error_message: null });

    const videoIds = await searchVideoIds(
      job.keyword,
      job.period_start,
      job.period_end,
      job.max_videos
    );
    const videos = await getVideoDetails(videoIds);

    if (videos.length > 0) {
      const { error: videosError } = await admin.from("youtube_videos").upsert(
        videos.map((v) => ({
          job_id: jobId,
          video_id: v.videoId,
          channel_id: v.channelId,
          channel_title: v.channelTitle,
          title: v.title,
          description: v.description,
          published_at: v.publishedAt,
          view_count: v.viewCount,
          like_count: v.likeCount,
          comment_count: v.commentCount,
        })),
        { onConflict: "video_id,job_id" }
      );
      if (videosError) throw new Error(`영상 저장 실패: ${videosError.message}`);
    }

    await setJobState(admin, jobId, { status: "collecting_comments", progress: 25 });

    // 2. 댓글 수집
    const allComments: CommentRow[] = [];
    for (let i = 0; i < videos.length; i++) {
      const v = videos[i];
      const comments = await getVideoComments(v.videoId, job.max_comments_per_video);
      for (const c of comments) {
        allComments.push({
          commentId: c.commentId,
          videoId: v.videoId,
          textOriginal: c.textOriginal,
          likeCount: c.likeCount,
          publishedAt: c.publishedAt,
        });
      }
      const pct = 25 + Math.round(((i + 1) / Math.max(videos.length, 1)) * 20);
      await setJobState(admin, jobId, { progress: pct });
    }

    if (allComments.length > 0) {
      const { error: commentsError } = await admin.from("youtube_comments").upsert(
        allComments.map((c) => ({
          job_id: jobId,
          video_id: c.videoId,
          comment_id: c.commentId,
          author_display: null,
          text_original: c.textOriginal,
          like_count: c.likeCount,
          published_at: c.publishedAt,
        })),
        { onConflict: "comment_id", ignoreDuplicates: true }
      );
      if (commentsError) throw new Error(`댓글 저장 실패: ${commentsError.message}`);
    }

    // 이 Job 소속으로 실제 저장된 댓글만 분석 대상으로 삼는다 (중복으로 스킵된 건 제외)
    const { data: storedComments, error: storedError } = await admin
      .from("youtube_comments")
      .select("comment_id, video_id, text_original, like_count, published_at")
      .eq("job_id", jobId);
    if (storedError) throw new Error(`댓글 조회 실패: ${storedError.message}`);

    const commentRows: CommentRow[] = (storedComments ?? []).map((c) => ({
      commentId: c.comment_id,
      videoId: c.video_id,
      textOriginal: c.text_original,
      likeCount: c.like_count,
      publishedAt: c.published_at,
    }));

    await setJobState(admin, jobId, { status: "analyzing", progress: 50 });

    // 3. 배치 감성/속성 분석
    const analyses = [];
    for (let i = 0; i < commentRows.length; i += COMMENT_BATCH_SIZE) {
      const batch = commentRows.slice(i, i + COMMENT_BATCH_SIZE);
      const results = await analyzeCommentBatch(
        job.keyword,
        batch.map((c) => ({ commentId: c.commentId, text: c.textOriginal }))
      );
      analyses.push(...results);

      if (results.length > 0) {
        const { error: analysisError } = await admin.from("comment_analysis").upsert(
          results.map((r) => ({
            job_id: jobId,
            comment_id: r.commentId,
            sentiment: r.sentiment,
            purchase_intent: r.purchaseIntent,
            ad_reaction: r.adReaction,
            risk_flag: r.riskFlag,
            extracted_keywords: r.extractedKeywords,
            fandom_expressions: r.fandomExpressions,
            raw_json: r,
            model_version: "claude-haiku-4-5-20251001",
          })),
          { onConflict: "comment_id" }
        );
        if (analysisError) throw new Error(`분석 결과 저장 실패: ${analysisError.message}`);
      }

      const pct = 50 + Math.round(((i + batch.length) / Math.max(commentRows.length, 1)) * 35);
      await setJobState(admin, jobId, { progress: Math.min(pct, 85) });
    }

    // 4. 집계 + 종합 인사이트
    const aggregates = computeAggregates(commentRows, analyses);

    const generated = await generateJobInsight({
      keyword: job.keyword,
      periodStart: job.period_start,
      periodEnd: job.period_end,
      videoCount: videos.length,
      commentCount: commentRows.length,
      topKeywords: aggregates.topKeywords,
      sentimentRatio: aggregates.sentimentRatio,
      dailyTrend: aggregates.dailyTrend,
      purchaseIntentPositiveRatio: aggregates.purchaseIntentSummary.positiveRatio,
      riskGroups: aggregates.riskGroups.map((g) => ({
        level: g.level,
        count: g.count,
        examples: g.examples,
      })),
    });

    const riskAlerts = aggregates.riskGroups.map((g) => {
      const desc = generated.riskAlerts.find((r) => r.level === g.level);
      return {
        level: g.level,
        description: desc?.description ?? `${g.level === "high_risk" ? "고위험" : "주의"} 댓글 ${g.count}건 발견`,
        example_comment_id: g.exampleCommentIds[0] ?? null,
      };
    });

    await setJobState(admin, jobId, { progress: 95 });

    const { error: insightError } = await admin.from("job_insights").upsert(
      {
        job_id: jobId,
        summary_text: generated.summaryText,
        top_keywords: aggregates.topKeywords,
        sentiment_ratio: aggregates.sentimentRatio,
        daily_trend: aggregates.dailyTrend,
        fandom_highlights: aggregates.fandomHighlights,
        purchase_intent_summary: aggregates.purchaseIntentSummary,
        risk_alerts: riskAlerts,
        raw_json: { aggregates, generated },
        model_version: "claude-sonnet-5",
      },
      { onConflict: "job_id" }
    );
    if (insightError) throw new Error(`인사이트 저장 실패: ${insightError.message}`);

    await setJobState(admin, jobId, { status: "done", progress: 100 });

    return NextResponse.json({ jobId, status: "done" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    await setJobState(admin, jobId, { status: "failed", error_message: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
