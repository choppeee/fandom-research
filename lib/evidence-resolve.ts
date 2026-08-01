import type { SupabaseClient } from "@supabase/supabase-js";
import {
  youtubeThumbnailUrl,
  youtubeWatchUrl,
  youtubeCommentUrl,
  type CommentEvidence,
  type VideoEvidence,
  type EvidencePackage,
  type Confidence,
} from "./evidence-types";

export type EvidenceCommentRow = {
  commentId: string;
  videoId: string | null;
  text: string;
  likeCount: number;
  publishedAt: string | null;
  platform: "youtube" | "x";
  url: string | null; // X 게시물은 자체 url을 가짐
};

export type EvidenceVideoRow = {
  videoId: string;
  title: string;
  channelTitle: string;
  publishedAt: string | null;
};

export type EvidenceSource = {
  comments: Map<string, EvidenceCommentRow>;
  videos: Map<string, EvidenceVideoRow>;
};

/** job의 전체 댓글/영상을 Evidence resolve용 Map으로 로드한다. 웹 insight 라우트와 PDF export
 * 라우트가 동일한 로직을 공유하도록 여기 한 곳에 둔다. */
export async function loadEvidenceSource(admin: SupabaseClient, jobId: string): Promise<EvidenceSource> {
  const [{ data: comments }, { data: videos }, { data: posts }] = await Promise.all([
    admin.from("youtube_comments").select("comment_id, video_id, text_original, like_count, published_at").eq("job_id", jobId),
    admin.from("youtube_videos").select("video_id, title, channel_title, published_at").eq("job_id", jobId),
    admin.from("social_posts").select("id, url, text_original, like_count, created_at").eq("job_id", jobId),
  ]);

  const commentMap = new Map<string, EvidenceCommentRow>();
  for (const c of comments ?? []) {
    commentMap.set(c.comment_id as string, {
      commentId: c.comment_id as string,
      videoId: c.video_id as string | null,
      text: c.text_original as string,
      likeCount: (c.like_count as number) ?? 0,
      publishedAt: c.published_at as string | null,
      platform: "youtube",
      url: null,
    });
  }
  for (const p of posts ?? []) {
    commentMap.set(p.id as string, {
      commentId: p.id as string,
      videoId: null,
      text: p.text_original as string,
      likeCount: (p.like_count as number) ?? 0,
      publishedAt: p.created_at as string | null,
      platform: "x",
      url: (p.url as string) ?? null,
    });
  }

  const videoMap = new Map<string, EvidenceVideoRow>();
  for (const v of videos ?? []) {
    videoMap.set(v.video_id as string, {
      videoId: v.video_id as string,
      title: (v.title as string) ?? "",
      channelTitle: (v.channel_title as string) ?? "",
      publishedAt: v.published_at as string | null,
    });
  }

  return { comments: commentMap, videos: videoMap };
}

function strengthFromConfidenceAndDiversity(confidence: Confidence, videoCount: number, commentCount: number): Confidence {
  if (commentCount === 0) return "LOW";
  if (confidence === "HIGH" && (videoCount >= 2 || commentCount >= 3)) return "HIGH";
  if (confidence === "LOW") return "LOW";
  return "MEDIUM";
}

/** LLM이 지목한 evidenceIds를 실제 DB row로 resolve한다 - 순수 함수, LLM 호출 없음.
 * source에 없는 ID는 조용히 버린다(모델이 지어냈거나 샘플 밖 ID를 잘못 인용한 경우 방어). */
export function buildEvidencePackage(params: {
  insightId: string;
  headline: string;
  evidenceIds: string[];
  confidence: Confidence;
  source: EvidenceSource;
}): EvidencePackage {
  const validComments: CommentEvidence[] = [];
  for (const id of params.evidenceIds) {
    const row = params.source.comments.get(id);
    if (!row) continue; // 실제 존재하지 않는 ID는 조용히 제외 - 절대 지어내지 않는다
    const video = row.videoId ? params.source.videos.get(row.videoId) : undefined;
    validComments.push({
      platform: row.platform,
      commentId: row.commentId,
      text: row.text,
      likeCount: row.likeCount,
      publishedAt: row.publishedAt,
      videoId: row.videoId,
      videoTitle: video?.title ?? null,
      url: row.platform === "x" ? row.url : row.videoId ? youtubeCommentUrl(row.videoId, row.commentId) : null,
    });
  }
  // ID 중복 제거 + 완전히 같은 문장을 복사한 댓글 제거(Comment Collage에서 같은 말 반복 노출 방지) + 좋아요 내림차순
  const byId = new Map(validComments.map((c) => [c.commentId, c]));
  const seenText = new Set<string>();
  const supportingComments = [...byId.values()]
    .sort((a, b) => b.likeCount - a.likeCount)
    .filter((c) => {
      const norm = c.text.trim().toLowerCase();
      if (seenText.has(norm)) return false;
      seenText.add(norm);
      return true;
    });

  // 영상별로 묶기 (youtube만 - x는 영상 개념이 없음)
  const byVideo = new Map<string, CommentEvidence[]>();
  for (const c of supportingComments) {
    if (c.platform !== "youtube" || !c.videoId) continue;
    const list = byVideo.get(c.videoId) ?? [];
    list.push(c);
    byVideo.set(c.videoId, list);
  }
  const supportingVideos: VideoEvidence[] = [...byVideo.entries()]
    .map(([videoId, cs]) => {
      const meta = params.source.videos.get(videoId);
      if (!meta) return null; // 영상 메타데이터가 없으면(수집 누락) 영상 카드를 만들지 않는다
      return {
        platform: "youtube" as const,
        videoId,
        url: youtubeWatchUrl(videoId),
        title: meta.title,
        channelTitle: meta.channelTitle,
        publishedAt: meta.publishedAt,
        thumbnailUrl: youtubeThumbnailUrl(videoId),
        commentCount: cs.length,
        totalLikes: cs.reduce((sum, c) => sum + c.likeCount, 0),
        representativeComments: cs.slice(0, 3),
      };
    })
    .filter((v): v is VideoEvidence => v !== null)
    .sort((a, b) => b.totalLikes - a.totalLikes);

  const platformSet = new Set(supportingComments.map((c) => c.platform));
  const totalLikes = supportingComments.reduce((sum, c) => sum + c.likeCount, 0);
  const videoCount = supportingVideos.length;
  const commentCount = supportingComments.length;

  const engagementSummary =
    commentCount > 0 ? `댓글 ${commentCount}건 · 좋아요 합계 ${totalLikes.toLocaleString("ko-KR")}` : "";
  const repetitionSummary =
    videoCount >= 2 ? `${videoCount}개 영상에서 반복 확인` : videoCount === 1 ? "1개 영상에서 확인" : commentCount > 0 ? "댓글 근거 확인" : "";

  let visualRecommendation: EvidencePackage["visualRecommendation"] = "no_visual";
  if (commentCount === 0) visualRecommendation = "no_visual";
  else if (videoCount >= 1 && commentCount === 1) visualRecommendation = "hero_video";
  else if (commentCount >= 3) visualRecommendation = "comment_collage";
  else visualRecommendation = "quote_card";

  return {
    insightId: params.insightId,
    headline: params.headline,
    supportingVideos,
    supportingComments,
    engagementSummary,
    repetitionSummary,
    sourceDiversity: { videoCount, platformCount: platformSet.size, commentCount },
    evidenceStrength: strengthFromConfidenceAndDiversity(params.confidence, videoCount, commentCount),
    visualRecommendation,
  };
}
