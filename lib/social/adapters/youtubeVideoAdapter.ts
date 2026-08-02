import { getVideoDetails, getVideoComments } from "../../collectors/youtube";
import { extractYoutubeVideoId } from "../../sources/youtubeUrlResolver";
import { youtubeThumbnailUrl } from "../../evidence-types";
import { capabilitiesFor } from "../capability-matrix";
import type { CollectionResult, NormalizedContent, NormalizedReaction, ResolvedSource, SourceAdapter, SourceResolveError } from "../types";

export const youtubeVideoAdapter: SourceAdapter = {
  sourceType: "youtube_video",
  platform: "youtube",

  matches(url) {
    return extractYoutubeVideoId(url) !== null;
  },

  async resolve(rawUrl) {
    const videoId = extractYoutubeVideoId(rawUrl);
    if (!videoId) {
      const error: SourceResolveError = { code: "invalid_url", message: "유효한 YouTube 영상 링크를 입력해주세요." };
      return { ok: false, error };
    }
    let details;
    try {
      details = await getVideoDetails([videoId]);
    } catch (err) {
      return { ok: false, error: { code: "api_error", message: `영상 정보를 가져오지 못했습니다: ${err instanceof Error ? err.message : String(err)}` } };
    }
    const video = details[0];
    if (!video) {
      return { ok: false, error: { code: "not_found", message: "영상을 찾을 수 없습니다. 삭제되었거나 비공개(연령 제한 포함) 영상일 수 있습니다." } };
    }
    const source: ResolvedSource = {
      sourceType: "youtube_video",
      platform: "youtube",
      sourceId: videoId,
      sourceUrl: `https://www.youtube.com/watch?v=${videoId}`,
      metadata: {
        title: video.title,
        channelTitle: video.channelTitle,
        publishedAt: video.publishedAt,
        thumbnailUrl: youtubeThumbnailUrl(videoId),
        viewCount: video.viewCount,
        likeCount: video.likeCount,
        commentCount: video.commentCount,
      },
      capabilities: capabilitiesFor("youtube_video"),
      dataOrigin: "official_api",
      connectionStatus: "not_applicable",
    };
    return { ok: true, source };
  },

  capabilities() {
    return capabilitiesFor("youtube_video");
  },

  async collect({ sourceId, jobId, maxItems }) {
    const [videos] = await Promise.all([getVideoDetails([sourceId])]);
    const video = videos[0];
    const posts = await getVideoComments(sourceId, maxItems, jobId);

    const contents: NormalizedContent[] = video
      ? [
          {
            externalContentId: video.videoId,
            contentType: "video",
            title: video.title,
            text: video.description,
            publishedAt: video.publishedAt,
            metrics: { viewCount: video.viewCount, likeCount: video.likeCount, commentCount: video.commentCount },
            nativeMetadata: { channelId: video.channelId, channelTitle: video.channelTitle },
          },
        ]
      : [];

    const reactions: NormalizedReaction[] = posts.map((p) => ({
      externalContentId: sourceId,
      reactionType: "comment",
      text: p.text,
      publishedAt: p.createdAt,
      engagement: { likeCount: p.likeCount },
      authorKey: p.authorKey ?? null, // getVideoComments가 이미 job 범위로 해시해서 돌려준다
    }));

    const result: CollectionResult = {
      contents,
      reactions,
      unavailableFields: [],
      limitationReasons: [],
      dataOrigin: "official_api",
    };
    return result;
  },
};
