import { capabilitiesFor } from "../capability-matrix";
import type { CollectionResult, NormalizedContent, NormalizedReaction, SourceAdapter } from "../types";

/** 컬럼 매핑이 끝난 업로드 파일 한 행. app/api/import/commit/route.ts가 사용자가 확인한
 * 매핑대로 원본 파일을 이 모양으로 변환해 sources.metadata.stagedRows에 저장해두고,
 * 이 어댑터의 collect()는 그걸 그대로 읽어 Content/Reaction으로 나눌 뿐이다 - 원본에
 * 없는 값은 여기서도 만들어내지 않는다. */
export type ImportedRow = {
  platform: string | null;
  accountName: string | null;
  sourceUrl: string | null;
  contentId: string | null;
  contentType: string | null;
  contentText: string | null; // caption/본문
  commentText: string | null;
  replyText: string | null;
  publishedAt: string | null;
  likeCount: number | null;
  viewCount: number | null;
  saveCount: number | null;
  shareCount: number | null;
  authorKey: string | null; // 업로드 파일에 작성자 식별자가 있었다면 커밋 시점에 이미 해시됨
  campaign: string | null;
  product: string | null;
  additionalMetadata: Record<string, unknown> | null;
};

/** URL이 아니라 사전 업로드 데이터를 다루는 소스라 matches()/resolve()는 실질적으로
 * 쓰이지 않는다(업로드 플로우는 /api/import/*가 직접 처리) - SourceAdapter 계약을
 * 지키기 위해서만 존재. */
export const importedDatasetAdapter: SourceAdapter = {
  sourceType: "imported_dataset",
  platform: "imported",

  matches() {
    return false;
  },

  async resolve() {
    return { ok: false, error: { code: "not_supported_yet", message: "업로드는 링크 붙여넣기가 아니라 파일 업로드로 진행합니다." } };
  },

  capabilities() {
    return capabilitiesFor("imported_dataset");
  },

  async collect({ jobId, sourceMetadata }) {
    const rows = (sourceMetadata?.stagedRows as ImportedRow[]) ?? [];

    // contentId가 있는 행은 같은 콘텐츠끼리 묶고, 없으면 행 하나 = 콘텐츠 하나 + 댓글 하나로 취급.
    const contentByKey = new Map<string, NormalizedContent>();
    const reactions: NormalizedReaction[] = [];
    let syntheticIndex = 0;

    for (const row of rows) {
      const key = row.contentId ?? `row-${syntheticIndex}`;
      if (!contentByKey.has(key)) {
        contentByKey.set(key, {
          // contentId가 없는 행은 합성 key(row-N)를 그대로 externalContentId로 써서
          // pipeline.ts의 collect_source가 반응(reaction)을 같은 콘텐츠에 연결할 수 있게 한다.
          externalContentId: key,
          contentType: row.contentType ?? "imported_row",
          title: null,
          text: row.contentText,
          publishedAt: row.publishedAt,
          metrics: {
            likeCount: row.likeCount,
            viewCount: row.viewCount,
            saveCount: row.saveCount,
            shareCount: row.shareCount,
          },
          nativeMetadata: {
            accountName: row.accountName,
            sourceUrl: row.sourceUrl,
            campaign: row.campaign,
            product: row.product,
            ...(row.additionalMetadata ?? {}),
          },
        });
      }

      const reactionText = row.commentText ?? row.replyText;
      if (reactionText) {
        reactions.push({
          externalContentId: key,
          reactionType: row.replyText ? "reply" : "comment",
          text: reactionText,
          publishedAt: row.publishedAt,
          engagement: { likeCount: row.likeCount },
          authorKey: row.authorKey,
        });
      }
      syntheticIndex++;
    }

    const result: CollectionResult = {
      contents: [...contentByKey.values()],
      reactions,
      unavailableFields: [],
      limitationReasons: rows.length === 0 ? [`job ${jobId}: 업로드된 행이 없습니다.`] : [],
      dataOrigin: "user_upload",
    };
    return result;
  },
};
