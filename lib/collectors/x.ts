import type { CollectParams, CollectResult, NormalizedPost, PlatformCollector } from "./types";
import { expandSearchQuery } from "../keyword-expansion";

const X_API_BASE = "https://api.twitter.com/2";

function bearerToken(): string | null {
  return process.env.X_BEARER_TOKEN?.trim() || null;
}

type XTweet = {
  id: string;
  text: string;
  author_id?: string;
  created_at?: string;
  lang?: string;
  public_metrics?: {
    like_count?: number;
    retweet_count?: number;
    reply_count?: number;
    quote_count?: number;
  };
  entities?: {
    hashtags?: { tag: string }[];
    mentions?: { username: string }[];
  };
  referenced_tweets?: { type: string; id: string }[];
};

type XUser = { id: string; username: string };

async function xFetch(path: string, params: Record<string, string>) {
  const token = bearerToken();
  if (!token) throw new Error("X_BEARER_TOKEN이 설정되지 않았습니다.");

  const url = new URL(`${X_API_BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`X API 오류 (${path}, ${res.status}): ${body.slice(0, 300)}`);
  }
  return res.json();
}

/**
 * X API v2 recent search로 게시물을 수집한다.
 * (recent search는 최근 7일 이내 게시물만 검색 가능 - X API 자체 제약)
 */
async function searchPosts(
  keyword: string,
  periodStart: string,
  periodEnd: string,
  maxPosts: number
): Promise<NormalizedPost[]> {
  const query = await expandSearchQuery(keyword, "x");
  const posts: NormalizedPost[] = [];
  let nextToken: string | undefined;
  const userCache = new Map<string, string>();

  while (posts.length < maxPosts) {
    const data = await xFetch("tweets/search/recent", {
      query,
      max_results: String(Math.min(100, Math.max(10, maxPosts - posts.length))),
      start_time: `${periodStart}T00:00:00Z`,
      end_time: `${periodEnd}T23:59:59Z`,
      "tweet.fields": "created_at,public_metrics,lang,entities,referenced_tweets",
      expansions: "author_id",
      "user.fields": "username",
      ...(nextToken ? { next_token: nextToken } : {}),
    });

    for (const user of (data.includes?.users ?? []) as XUser[]) {
      userCache.set(user.id, user.username);
    }

    for (const tweet of (data.data ?? []) as XTweet[]) {
      const username = tweet.author_id ? userCache.get(tweet.author_id) : undefined;
      posts.push({
        platform: "x",
        externalId: tweet.id,
        url: username ? `https://x.com/${username}/status/${tweet.id}` : `https://x.com/i/status/${tweet.id}`,
        author: username ?? null,
        text: tweet.text,
        createdAt: tweet.created_at ?? null,
        likeCount: tweet.public_metrics?.like_count ?? 0,
        shareCount: tweet.public_metrics?.retweet_count ?? 0,
        replyCount: tweet.public_metrics?.reply_count ?? 0,
        quoteCount: tweet.public_metrics?.quote_count ?? 0,
        language: tweet.lang ?? null,
        hashtags: (tweet.entities?.hashtags ?? []).map((h) => h.tag),
        mentions: (tweet.entities?.mentions ?? []).map((m) => m.username),
        referencedPostId: tweet.referenced_tweets?.[0]?.id ?? null,
        searchQuery: query,
      });
    }

    nextToken = data.meta?.next_token;
    if (!nextToken || (data.data ?? []).length === 0) break;
  }

  return posts.slice(0, maxPosts);
}

export const xCollector: PlatformCollector = {
  platform: "x",
  isConfigured() {
    return Boolean(bearerToken());
  },
  async collect(params: CollectParams): Promise<CollectResult> {
    if (!this.isConfigured()) {
      return { configured: false, note: "X_NOT_CONFIGURED", posts: [] };
    }
    const maxPosts = params.maxPosts ?? 100;
    const posts = await searchPosts(params.keyword, params.periodStart, params.periodEnd, maxPosts);
    return { configured: true, posts };
  },
};
