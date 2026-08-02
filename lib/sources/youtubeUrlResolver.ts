import { getVideoDetails } from "../collectors/youtube";
import { youtubeThumbnailUrl } from "../evidence-types";
import type { SourceResolver, SourceResolveError } from "./types";

/** youtube.com/watch?v=, youtu.be/, /shorts/, /live/ 및 부가 query parameter가 붙은
 * 공유 URL에서 videoId를 안전하게 추출한다. 매칭 안 되면 null. */
export function extractYoutubeVideoId(rawUrl: string): string | null {
  let url: URL;
  try {
    // 프로토콜 없이 붙여넣는 경우("youtube.com/watch?v=...")도 처리
    url = new URL(rawUrl.trim().match(/^https?:\/\//) ? rawUrl.trim() : `https://${rawUrl.trim()}`);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\.|^m\./, "");
  const idPattern = /^[A-Za-z0-9_-]{11}$/;

  if (host === "youtu.be") {
    const id = url.pathname.slice(1).split("/")[0];
    return idPattern.test(id) ? id : null;
  }

  if (host === "youtube.com" || host === "music.youtube.com") {
    if (url.pathname === "/watch") {
      const id = url.searchParams.get("v");
      return id && idPattern.test(id) ? id : null;
    }
    const shortsMatch = url.pathname.match(/^\/shorts\/([A-Za-z0-9_-]{11})/);
    if (shortsMatch) return shortsMatch[1];
    const liveMatch = url.pathname.match(/^\/live\/([A-Za-z0-9_-]{11})/);
    if (liveMatch) return liveMatch[1];
    const embedMatch = url.pathname.match(/^\/embed\/([A-Za-z0-9_-]{11})/);
    if (embedMatch) return embedMatch[1];
  }

  return null;
}

export const youtubeUrlResolver: SourceResolver = {
  sourceType: "youtube_video",

  matches(url: string): boolean {
    return extractYoutubeVideoId(url) !== null;
  },

  async resolve(rawUrl: string) {
    const videoId = extractYoutubeVideoId(rawUrl);
    if (!videoId) {
      const error: SourceResolveError = { code: "invalid_url", message: "유효한 YouTube 영상 링크를 입력해주세요." };
      return { ok: false as const, error };
    }

    let details;
    try {
      details = await getVideoDetails([videoId]);
    } catch (err) {
      const error: SourceResolveError = {
        code: "api_error",
        message: `영상 정보를 가져오지 못했습니다: ${err instanceof Error ? err.message : String(err)}`,
      };
      return { ok: false as const, error };
    }

    const video = details[0];
    if (!video) {
      // videos.list가 빈 결과를 주는 경우 - 삭제됐거나 비공개(연령제한 포함)인 영상 모두 동일하게
      // 관찰됨. YouTube API가 이 둘을 구분해서 알려주지 않아 하나의 메시지로 안내한다.
      const error: SourceResolveError = {
        code: "not_found",
        message: "영상을 찾을 수 없습니다. 삭제되었거나 비공개(연령 제한 포함) 영상일 수 있습니다.",
      };
      return { ok: false as const, error };
    }

    return {
      ok: true as const,
      source: {
        sourceType: "youtube_video" as const,
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
      },
    };
  },
};
