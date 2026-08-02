import { getChannelRecentVideoIds, getVideoComments, getVideoDetails, resolveChannel } from "../../collectors/youtube";
import { capabilitiesFor } from "../capability-matrix";
import type { CollectionResult, NormalizedContent, NormalizedReaction, ResolvedSource, SourceAdapter, SourceResolveError } from "../types";

const MAX_CHANNEL_VIDEOS_DEFAULT = 20;

function parseChannelRef(rawUrl: string): { handle?: string; channelId?: string; legacyUsername?: string } | null {
  let url: URL;
  try {
    url = new URL(rawUrl.trim().match(/^https?:\/\//) ? rawUrl.trim() : `https://${rawUrl.trim()}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\.|^m\./, "");
  if (host !== "youtube.com") return null;

  const handleMatch = url.pathname.match(/^\/@([\w.-]+)/);
  if (handleMatch) return { handle: `@${handleMatch[1]}` };

  const channelMatch = url.pathname.match(/^\/channel\/(UC[\w-]{22})/);
  if (channelMatch) return { channelId: channelMatch[1] };

  const userMatch = url.pathname.match(/^\/(?:c|user)\/([\w.-]+)/);
  if (userMatch) return { legacyUsername: userMatch[1] };

  return null;
}

export const youtubeChannelAdapter: SourceAdapter = {
  sourceType: "youtube_channel",
  platform: "youtube",

  matches(url) {
    return parseChannelRef(url) !== null;
  },

  async resolve(rawUrl) {
    const ref = parseChannelRef(rawUrl);
    if (!ref) {
      const error: SourceResolveError = { code: "invalid_url", message: "유효한 YouTube 채널 링크(@handle, /channel/, /c/)를 입력해주세요." };
      return { ok: false, error };
    }
    let channel;
    try {
      channel = await resolveChannel(ref);
    } catch (err) {
      return { ok: false, error: { code: "api_error", message: `채널 정보를 가져오지 못했습니다: ${err instanceof Error ? err.message : String(err)}` } };
    }
    if (!channel) {
      return { ok: false, error: { code: "not_found", message: "채널을 찾을 수 없습니다." } };
    }
    const source: ResolvedSource = {
      sourceType: "youtube_channel",
      platform: "youtube",
      sourceId: channel.channelId,
      sourceUrl: `https://www.youtube.com/channel/${channel.channelId}`,
      metadata: {
        title: channel.title,
        description: channel.description,
        subscriberCount: channel.subscriberCount,
        videoCount: channel.videoCount,
      },
      capabilities: capabilitiesFor("youtube_channel"),
      dataOrigin: "official_api",
      connectionStatus: "not_applicable",
    };
    return { ok: true, source };
  },

  capabilities() {
    return capabilitiesFor("youtube_channel");
  },

  async collect({ sourceId, jobId, maxItems }) {
    const maxVideos = Math.min(50, Math.max(1, Math.floor(maxItems / 10) || MAX_CHANNEL_VIDEOS_DEFAULT));
    const videoIds = await getChannelRecentVideoIds(sourceId, maxVideos);
    const videos = await getVideoDetails(videoIds);

    const contents: NormalizedContent[] = videos.map((v) => ({
      externalContentId: v.videoId,
      contentType: "video",
      title: v.title,
      text: v.description,
      publishedAt: v.publishedAt,
      metrics: { viewCount: v.viewCount, likeCount: v.likeCount, commentCount: v.commentCount },
      nativeMetadata: { channelId: v.channelId, channelTitle: v.channelTitle },
    }));

    const perVideoCommentCap = Math.max(5, Math.floor(maxItems / Math.max(1, videos.length)));
    const reactions: NormalizedReaction[] = [];
    for (const v of videos) {
      const posts = await getVideoComments(v.videoId, perVideoCommentCap, jobId);
      for (const p of posts) {
        reactions.push({
          externalContentId: v.videoId,
          reactionType: "comment",
          text: p.text,
          publishedAt: p.createdAt,
          engagement: { likeCount: p.likeCount },
          authorKey: p.authorKey ?? null,
        });
      }
    }

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
