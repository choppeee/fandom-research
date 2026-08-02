import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { computeAuthorKey } from "@/lib/author-key";
import { IMPORT_TARGET_FIELDS, type ImportTargetField } from "@/lib/import/schema";
import type { ImportedRow } from "@/lib/social/adapters/importedDatasetAdapter";

const MAX_ROWS = 500;
const NUMERIC_FIELDS = new Set(IMPORT_TARGET_FIELDS.filter((f) => f.numeric).map((f) => f.key));

function toNumberOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function toStringOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const rawRows = Array.isArray(body?.rows) ? (body.rows as Record<string, unknown>[]) : null;
  const mapping = (body?.mapping ?? {}) as Record<ImportTargetField, string | null>;
  const datasetLabel = String(body?.datasetLabel ?? "").trim();
  const sourceTypeHint = ["imported_dataset", "voc_dataset", "review_dataset"].includes(body?.sourceType)
    ? (body.sourceType as string)
    : "imported_dataset";

  if (!rawRows || rawRows.length === 0) {
    return NextResponse.json({ error: "업로드할 데이터가 없습니다. 먼저 파일을 업로드해주세요." }, { status: 400 });
  }
  if (!mapping.commentText && !mapping.contentText) {
    return NextResponse.json(
      { error: "댓글/본문에 해당하는 컬럼을 최소 하나는 매핑해야 분석할 수 있습니다." },
      { status: 400 }
    );
  }

  const limitedRows = rawRows.slice(0, MAX_ROWS);

  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);
  const title = datasetLabel || `업로드 데이터셋 (${limitedRows.length}건)`;

  const { data: job, error: jobError } = await admin
    .from("research_jobs")
    .insert({
      user_id: user.id,
      keyword: title.slice(0, 200),
      period_start: today,
      period_end: today,
      max_videos: 1,
      max_comments_per_video: limitedRows.length,
      status: "pending",
      research_mode: "broad_research",
      source_type: sourceTypeHint,
      source_url: null,
      source_id: null,
      source_metadata: { rowCount: limitedRows.length },
      uses_common_schema: true,
    })
    .select("id, status")
    .single();

  if (jobError || !job) {
    return NextResponse.json({ error: `Job 생성 실패: ${jobError?.message ?? "알 수 없는 오류"}` }, { status: 500 });
  }

  // 원본 작성자 식별자는 절대 그대로 저장하지 않는다 - job.id가 생긴 이 시점에 바로 job 범위
  // 익명 키로 해시하고, 원본 값은 이 요청 처리 범위를 벗어나면 버려진다.
  const get = (row: Record<string, unknown>, field: ImportTargetField): unknown => {
    const header = mapping[field];
    return header ? row[header] : undefined;
  };

  const mappedRows: ImportedRow[] = [];
  const seenKeys = new Set<string>();
  let duplicateCount = 0;
  for (const row of limitedRows) {
    const authorIdRaw = toStringOrNull(get(row, "authorId"));
    const mapped: ImportedRow = {
      platform: toStringOrNull(get(row, "platform")),
      accountName: toStringOrNull(get(row, "accountName")),
      sourceUrl: toStringOrNull(get(row, "sourceUrl")),
      contentId: toStringOrNull(get(row, "contentId")),
      contentType: toStringOrNull(get(row, "contentType")),
      contentText: toStringOrNull(get(row, "contentText")),
      commentText: toStringOrNull(get(row, "commentText")),
      replyText: toStringOrNull(get(row, "replyText")),
      publishedAt: toStringOrNull(get(row, "publishedAt")),
      likeCount: NUMERIC_FIELDS.has("likeCount") ? toNumberOrNull(get(row, "likeCount")) : null,
      viewCount: toNumberOrNull(get(row, "viewCount")),
      saveCount: toNumberOrNull(get(row, "saveCount")),
      shareCount: toNumberOrNull(get(row, "shareCount")),
      authorKey: authorIdRaw ? computeAuthorKey(job.id, authorIdRaw) : null,
      campaign: toStringOrNull(get(row, "campaign")),
      product: toStringOrNull(get(row, "product")),
      additionalMetadata: null,
    };

    // 분석 가능한 텍스트(댓글/본문)가 전혀 없는 행은 애초에 반응으로 만들 수 없다 - 건너뛴다.
    if (!mapped.commentText && !mapped.replyText && !mapped.contentText) continue;

    const dedupKey = JSON.stringify([mapped.contentId, mapped.commentText, mapped.replyText, mapped.publishedAt]);
    if (seenKeys.has(dedupKey)) {
      duplicateCount++;
      continue;
    }
    seenKeys.add(dedupKey);
    mappedRows.push(mapped);
  }

  if (mappedRows.length === 0) {
    await admin.from("research_jobs").delete().eq("id", job.id);
    return NextResponse.json({ error: "매핑 결과 분석 가능한 행이 없습니다. 컬럼 매핑을 확인해주세요." }, { status: 400 });
  }

  const { error: sourceError } = await admin.from("sources").insert({
    job_id: job.id,
    platform: "imported",
    source_type: sourceTypeHint,
    source_url: null,
    external_id: null,
    data_origin: "user_upload",
    account_connection_id: null,
    metadata: { stagedRows: mappedRows, datasetLabel: title },
    availability: null,
  });

  if (sourceError) {
    await admin.from("research_jobs").delete().eq("id", job.id);
    return NextResponse.json({ error: `소스 저장 실패: ${sourceError.message}` }, { status: 500 });
  }

  return NextResponse.json({
    jobId: job.id,
    status: job.status,
    rowCount: mappedRows.length,
    duplicateRowsRemoved: duplicateCount,
    skippedEmptyRows: limitedRows.length - mappedRows.length - duplicateCount,
  });
}
