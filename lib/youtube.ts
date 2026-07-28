const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

export type YoutubeVideo = {
  videoId: string;
  channelId: string | null;
  channelTitle: string | null;
  title: string | null;
  description: string | null;
  publishedAt: string | null;
  viewCount: number;
  likeCount: number;
  commentCount: number;
};

export type YoutubeComment = {
  commentId: string;
  authorDisplay: string | null;
  textOriginal: string;
  likeCount: number;
  publishedAt: string | null;
};

function apiKey() {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error("YOUTUBE_API_KEY가 설정되지 않았습니다.");
  return key;
}

async function youtubeFetch(path: string, params: Record<string, string>) {
  const url = new URL(`${YOUTUBE_API_BASE}/${path}`);
  url.searchParams.set("key", apiKey());
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`YouTube API 오류 (${path}, ${res.status}): ${body.slice(0, 300)}`);
  }
  return res.json();
}

/** 키워드+기간으로 영상 ID를 검색한다 (search.list, 페이지당 최대 50개). */
export async function searchVideoIds(
  keyword: string,
  periodStart: string,
  periodEnd: string,
  maxVideos: number
): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;

  while (ids.length < maxVideos) {
    const data = await youtubeFetch("search", {
      part: "id",
      q: keyword,
      type: "video",
      order: "relevance",
      publishedAfter: `${periodStart}T00:00:00Z`,
      publishedBefore: `${periodEnd}T23:59:59Z`,
      maxResults: String(Math.min(50, maxVideos - ids.length)),
      ...(pageToken ? { pageToken } : {}),
    });

    for (const item of data.items ?? []) {
      if (item.id?.videoId) ids.push(item.id.videoId);
    }

    pageToken = data.nextPageToken;
    if (!pageToken || (data.items ?? []).length === 0) break;
  }

  return ids.slice(0, maxVideos);
}

/** 영상 ID 목록으로 상세 메타데이터/통계를 가져온다 (videos.list, 50개씩 배치). */
export async function getVideoDetails(videoIds: string[]): Promise<YoutubeVideo[]> {
  const results: YoutubeVideo[] = [];

  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    const data = await youtubeFetch("videos", {
      part: "snippet,statistics",
      id: batch.join(","),
    });

    for (const item of data.items ?? []) {
      results.push({
        videoId: item.id,
        channelId: item.snippet?.channelId ?? null,
        channelTitle: item.snippet?.channelTitle ?? null,
        title: item.snippet?.title ?? null,
        description: item.snippet?.description ?? null,
        publishedAt: item.snippet?.publishedAt ?? null,
        viewCount: Number(item.statistics?.viewCount ?? 0),
        likeCount: Number(item.statistics?.likeCount ?? 0),
        commentCount: Number(item.statistics?.commentCount ?? 0),
      });
    }
  }

  return results;
}

/**
 * 영상 하나의 top-level 댓글을 가져온다 (commentThreads.list).
 * 댓글이 비활성화된 영상(403)은 빈 배열을 반환한다.
 */
export async function getVideoComments(
  videoId: string,
  maxComments: number
): Promise<YoutubeComment[]> {
  const comments: YoutubeComment[] = [];
  let pageToken: string | undefined;

  while (comments.length < maxComments) {
    let data;
    try {
      data = await youtubeFetch("commentThreads", {
        part: "snippet",
        videoId,
        order: "relevance",
        textFormat: "plainText",
        maxResults: String(Math.min(100, maxComments - comments.length)),
        ...(pageToken ? { pageToken } : {}),
      });
    } catch {
      // 댓글 비활성화, 삭제된 영상 등 - 해당 영상만 건너뜀
      return comments;
    }

    for (const item of data.items ?? []) {
      const top = item.snippet?.topLevelComment?.snippet;
      if (!top) continue;
      comments.push({
        commentId: item.snippet.topLevelComment.id,
        authorDisplay: top.authorDisplayName ?? null,
        textOriginal: top.textOriginal ?? "",
        likeCount: Number(top.likeCount ?? 0),
        publishedAt: top.publishedAt ?? null,
      });
    }

    pageToken = data.nextPageToken;
    if (!pageToken || (data.items ?? []).length === 0) break;
  }

  return comments.slice(0, maxComments);
}
