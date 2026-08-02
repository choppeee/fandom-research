import type { CollectParams, CollectResult, NormalizedPost, NormalizedVideo, PlatformCollector } from "./types";
import { mapWithConcurrency } from "../concurrency";
import { computeAuthorKey } from "../author-key";

const COLLECT_CONCURRENCY = 5;

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

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
export async function getVideoDetails(videoIds: string[]): Promise<NormalizedVideo[]> {
  const results: NormalizedVideo[] = [];

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
 *
 * 개인정보 최소화 원칙(PLAN.md 8.2): 작성자 실명/프로필/원본 채널 ID는 저장하지 않는다.
 * 단, YouTube API가 함께 내려주는 authorChannelId는 "같은 job 안에서 같은 작성자인지"
 * 판별하는 데만 필요하므로, 이 함수 안에서 즉시 job 범위 익명 키(authorKey)로 변환하고
 * 원본 채널 ID는 그 자리에서 버린다 - 반환되는 NormalizedPost에도 원본은 담기지 않는다.
 */
export async function getVideoComments(
  videoId: string,
  maxComments: number,
  jobId: string
): Promise<NormalizedPost[]> {
  const comments: NormalizedPost[] = [];
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
    } catch (err) {
      // 댓글 비활성화, 삭제된 영상 등 - 해당 영상만 건너뛰지만, 원인은 로그로 남겨
      // 할당량 초과 등 진짜 문제를 조용히 숨기지 않는다.
      console.error(`[getVideoComments] ${videoId} 댓글 수집 실패: ${err instanceof Error ? err.message : String(err)}`);
      return comments;
    }

    for (const item of data.items ?? []) {
      const top = item.snippet?.topLevelComment?.snippet;
      if (!top) continue;
      // authorChannelId가 없는 댓글(탈퇴 계정 등)은 작성자 식별 없이(authorKey: null) 저장한다 -
      // 작성자명이나 프로필 이미지로 대신 추정하지 않는다.
      const rawChannelId: string | undefined = top.authorChannelId?.value;
      const authorKey = rawChannelId ? computeAuthorKey(jobId, rawChannelId) : null;
      comments.push({
        platform: "youtube",
        externalId: item.snippet.topLevelComment.id,
        url: `https://www.youtube.com/watch?v=${videoId}&lc=${item.snippet.topLevelComment.id}`,
        author: null, // 개인정보 최소화 원칙 (PLAN.md 8.2) - 원본 작성자 정보는 저장하지 않는다
        authorKey,
        text: top.textOriginal ?? "",
        createdAt: top.publishedAt ?? null,
        likeCount: Number(top.likeCount ?? 0),
        videoId,
      });
    }

    pageToken = data.nextPageToken;
    if (!pageToken || (data.items ?? []).length === 0) break;
  }

  return comments.slice(0, maxComments);
}

export type NormalizedChannel = {
  channelId: string;
  title: string | null;
  description: string | null;
  customUrl: string | null;
  subscriberCount: number;
  videoCount: number;
};

/** @handle, /channel/UCxxxx, /c/이름, /user/이름 등 채널을 가리키는 값에서 channelId를 찾는다.
 * @handle은 channels.list?forHandle=로, 나머지 레거시 형태는 각각의 파라미터로 조회한다. */
export async function resolveChannel(handleOrId: { handle?: string; channelId?: string; legacyUsername?: string }): Promise<NormalizedChannel | null> {
  const params: Record<string, string> = { part: "snippet,statistics" };
  if (handleOrId.channelId) params.id = handleOrId.channelId;
  else if (handleOrId.handle) params.forHandle = handleOrId.handle;
  else if (handleOrId.legacyUsername) params.forUsername = handleOrId.legacyUsername;
  else return null;

  const data = await youtubeFetch("channels", params);
  const item = data.items?.[0];
  if (!item) return null;
  return {
    channelId: item.id,
    title: item.snippet?.title ?? null,
    description: item.snippet?.description ?? null,
    customUrl: item.snippet?.customUrl ?? null,
    subscriberCount: Number(item.statistics?.subscriberCount ?? 0),
    videoCount: Number(item.statistics?.videoCount ?? 0),
  };
}

/** 채널의 최근 업로드 영상 ID를 최신순으로 가져온다 (search.list, order=date). */
export async function getChannelRecentVideoIds(channelId: string, maxVideos: number): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;

  while (ids.length < maxVideos) {
    const data = await youtubeFetch("search", {
      part: "id",
      channelId,
      type: "video",
      order: "date",
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

export const youtubeCollector: PlatformCollector = {
  platform: "youtube",
  isConfigured() {
    return Boolean(process.env.YOUTUBE_API_KEY);
  },
  async collect(params: CollectParams): Promise<CollectResult> {
    if (!this.isConfigured()) {
      return { configured: false, note: "YOUTUBE_NOT_CONFIGURED", posts: [] };
    }
    const maxVideos = params.maxVideos ?? 20;
    const maxCommentsPerVideo = params.maxCommentsPerVideo ?? 30;

    const videoIds = await searchVideoIds(params.keyword, params.periodStart, params.periodEnd, maxVideos);
    const videos = await getVideoDetails(videoIds);

    const postChunks = await mapWithConcurrency(videos, COLLECT_CONCURRENCY, async (v) => {
      const comments = await getVideoComments(v.videoId, maxCommentsPerVideo, params.jobId);
      return comments.map((c) => ({ ...c, searchQuery: params.keyword }));
    });

    return { configured: true, posts: postChunks.flat(), videos };
  },
};
