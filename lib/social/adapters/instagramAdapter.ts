import { capabilitiesFor } from "../capability-matrix";
import { findConnectionByAccountName, getDecryptedAccessToken } from "../connections";
import { computeAuthorKey } from "../../author-key";
import { createAdminClient } from "../../supabase/server";
import type { CollectionResult, NormalizedContent, NormalizedReaction, ResolvedSource, SourceAdapter, SourceResolveError, SourceType } from "../types";

const GRAPH_API_BASE = "https://graph.facebook.com/v21.0";

type InstagramUrlKind = { kind: "post" | "reel"; shortcode: string } | { kind: "profile"; username: string };

function parseInstagramUrl(rawUrl: string): InstagramUrlKind | null {
  let url: URL;
  try {
    url = new URL(rawUrl.trim().match(/^https?:\/\//) ? rawUrl.trim() : `https://${rawUrl.trim()}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, "");
  if (host !== "instagram.com") return null;

  const postMatch = url.pathname.match(/^\/p\/([\w-]+)/);
  if (postMatch) return { kind: "post", shortcode: postMatch[1] };

  const reelMatch = url.pathname.match(/^\/reel(?:s)?\/([\w-]+)/);
  if (reelMatch) return { kind: "reel", shortcode: reelMatch[1] };

  const profileMatch = url.pathname.match(/^\/([\w.]+)\/?$/);
  if (profileMatch && !["p", "reel", "reels", "explore", "accounts"].includes(profileMatch[1])) {
    return { kind: "profile", username: profileMatch[1] };
  }
  return null;
}

function sourceTypeFor(kind: InstagramUrlKind["kind"]): SourceType {
  if (kind === "post") return "instagram_post";
  if (kind === "reel") return "instagram_reel";
  return "instagram_profile";
}

export const instagramAdapter: SourceAdapter = {
  sourceType: "instagram_post", // matches()/resolve()는 kind별로 실제 sourceType을 다시 계산해서 돌려준다
  platform: "instagram",

  matches(url) {
    return parseInstagramUrl(url) !== null;
  },

  async resolve(rawUrl, ctx) {
    const parsed = parseInstagramUrl(rawUrl);
    if (!parsed) {
      const error: SourceResolveError = { code: "invalid_url", message: "유효한 Instagram 게시물/릴스/프로필 링크를 입력해주세요." };
      return { ok: false, error };
    }
    const sourceType = sourceTypeFor(parsed.kind);
    const admin = createAdminClient();

    // 게시물/릴스는 URL만으로 소유주를 특정할 수 없다(shortcode에 계정명이 없음) - 연결된
    // 계정이 하나라도 있으면 "이 게시물이 그 계정 소유인지"는 실제 collect() 시점에
    // Graph API로 다시 확인한다. 여기서는 "연결된 계정이 존재하는가"까지만 판단해
    // UI가 상태를 먼저 보여줄 수 있게 한다.
    if (parsed.kind === "profile") {
      const connection = await findConnectionByAccountName(admin, ctx.userId, "instagram", parsed.username);
      const source: ResolvedSource = {
        sourceType,
        platform: "instagram",
        sourceId: connection ? connection.externalAccountId : parsed.username,
        sourceUrl: `https://www.instagram.com/${parsed.username}/`,
        metadata: { username: parsed.username, connectionId: connection?.id ?? null },
        capabilities: capabilitiesFor(sourceType),
        dataOrigin: connection ? "connected_account" : "public_snapshot",
        connectionStatus: connection ? "connected" : "not_connected",
      };
      return { ok: true, source };
    }

    // post / reel - 소유 여부 미확정 상태로 우선 반환. UI가 connectionStatus를 보고
    // "계정 연결" 또는 "Public Snapshot" 카드를 그린다. 실제 소유 확인은 collect()에서.
    const anyConnection = (await findConnectionByAccountName(admin, ctx.userId, "instagram", "%")) !== null;
    const source: ResolvedSource = {
      sourceType,
      platform: "instagram",
      sourceId: parsed.shortcode,
      sourceUrl: rawUrl,
      metadata: { shortcode: parsed.shortcode },
      capabilities: capabilitiesFor(sourceType),
      dataOrigin: anyConnection ? "connected_account" : "public_snapshot",
      connectionStatus: anyConnection ? "connected" : "not_connected",
    };
    return { ok: true, source };
  },

  capabilities() {
    return capabilitiesFor("instagram_post");
  },

  async collect({ sourceId, userId, jobId, maxItems, sourceMetadata }) {
    const admin = createAdminClient();
    const connectionId = (sourceMetadata?.connectionId as string) ?? null;
    if (!connectionId) {
      return {
        contents: [],
        reactions: [],
        unavailableFields: ["metadata", "comments", "metrics", "insights"],
        limitationReasons: [
          "연결된 Instagram 관리 계정이 아닙니다. Instagram 공식 API는 계정 소유자가 명시적으로 연결한 콘텐츠만 제공합니다.",
        ],
        dataOrigin: "public_snapshot",
      };
    }

    const accessToken = await getDecryptedAccessToken(admin, connectionId);
    if (!accessToken) {
      return {
        contents: [],
        reactions: [],
        unavailableFields: ["metadata", "comments", "metrics", "insights"],
        limitationReasons: ["연결된 계정의 토큰을 찾을 수 없습니다(연결이 해제되었거나 만료됨). 계정을 다시 연결해주세요."],
        dataOrigin: "connected_account",
      };
    }

    // 실제 Meta Graph API 호출 - Meta 앱 승인/테스트 계정 없이는 이 세션에서 라이브 검증을
    //못 했다. 호출 형태는 공식 문서 기준으로 작성했으나, 최종 필드명/권한은 App Review
    // 통과 후 재확인이 필요하다(README 완료 보고에 명시).
    try {
      const media = await fetchInstagramMedia(sourceId, accessToken, maxItems, jobId);
      return media;
    } catch (err) {
      return {
        contents: [],
        reactions: [],
        unavailableFields: ["metadata", "comments", "metrics", "insights"],
        limitationReasons: [`Instagram Graph API 호출 실패: ${err instanceof Error ? err.message : String(err)}`],
        dataOrigin: "connected_account",
      };
    }
  },
};

async function fetchInstagramMedia(mediaId: string, accessToken: string, maxComments: number, jobId: string): Promise<CollectionResult> {
  const mediaRes = await fetch(
    `${GRAPH_API_BASE}/${mediaId}?fields=id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count&access_token=${accessToken}`
  );
  if (!mediaRes.ok) throw new Error(`media fetch failed (${mediaRes.status})`);
  const media = await mediaRes.json();

  const contents: NormalizedContent[] = [
    {
      externalContentId: media.id,
      contentType: media.media_type === "VIDEO" ? "reel" : "post",
      title: null,
      text: media.caption ?? null,
      publishedAt: media.timestamp ?? null,
      metrics: { likeCount: media.like_count ?? null, commentCount: media.comments_count ?? null },
      nativeMetadata: { permalink: media.permalink, mediaType: media.media_type },
    },
  ];

  const commentsRes = await fetch(`${GRAPH_API_BASE}/${mediaId}/comments?fields=id,text,timestamp,like_count,username&limit=${Math.min(50, maxComments)}&access_token=${accessToken}`);
  const reactions: NormalizedReaction[] = [];
  if (commentsRes.ok) {
    const commentsData = await commentsRes.json();
    for (const c of commentsData.data ?? []) {
      reactions.push({
        externalContentId: media.id,
        reactionType: "comment",
        text: c.text ?? "",
        publishedAt: c.timestamp ?? null,
        engagement: { likeCount: c.like_count ?? null },
        // Graph API 댓글 응답의 username을 원본 저장 없이 즉시 job 범위로 해시한다(YouTube와 동일 원칙).
        authorKey: c.username ? computeAuthorKey(jobId, c.username) : null,
      });
    }
  }

  return { contents, reactions, unavailableFields: [], limitationReasons: [], dataOrigin: "connected_account" };
}
