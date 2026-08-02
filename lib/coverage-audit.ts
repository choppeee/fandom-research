/** "리포트가 대상 전체를 봤다"는 인상과 "실제로 몇 개 콘텐츠/댓글이 최종 결론에 반영됐는가"
 * 사이의 간극을 추적하는 모듈. 대표 Evidence(evidenceIds, 독자에게 보여줄 3~4개 사례)와
 * 실제 반복 범위(supportingCoverage, 전체 댓글을 다시 훑어야 아는 값)를 분리해서 계산한다.
 *
 * 이 파일의 함수는 전부 결정론적이다(LLM 호출 없음) - 전체 댓글을 다시 훑어 패턴 매칭을
 * 하는 부분은 lib/synthesis-modules.ts의 runCoverageClassification이 담당하고, 그 결과를
 * 여기 있는 함수들의 입력으로 받는다. */

import type { StructuredInsight, SupportingCoverage } from "./insight-types";

/** job 전체 기준 author_key 데이터 가용성.
 * - available: 댓글의 80% 이상에 author_key가 있음(신규 job, 정상 수집)
 * - partial: 일부 댓글에만 있음(신규 job이지만 authorChannelId 없는 댓글 비중이 큼)
 * - unavailable: 이 job에 댓글 자체가 없음(수집 실패/진행 중)
 * - unavailable_legacy_data: 댓글은 있지만 author_key가 하나도 없음 - author_key 컬럼이
 *   생기기 전에 수집된 job으로 추정(재수집 전에는 복원 불가, 임의로 만들어내지 않는다)
 */
export type AuthorMetricStatus = "available" | "partial" | "unavailable" | "unavailable_legacy_data";

export function computeAuthorMetricStatus(totalCommentsAnalyzed: number, commentsWithAuthorKeyTotal: number): AuthorMetricStatus {
  if (totalCommentsAnalyzed === 0) return "unavailable";
  if (commentsWithAuthorKeyTotal === 0) return "unavailable_legacy_data";
  const rate = commentsWithAuthorKeyTotal / totalCommentsAnalyzed;
  return rate >= 0.8 ? "available" : "partial";
}

/** 특정 댓글 집합(한 insight의 matched_comment_ids) 안에서 작성자 지표를 계산한다.
 * authorKey 자체는 반환하지 않는다 - 집계된 숫자만. */
export function computeInsightAuthorCoverage(params: {
  matchedCommentIds: string[];
  commentToAuthorKey: Map<string, string | null>;
}): Pick<
  SupportingCoverage,
  "commentsWithAuthorKey" | "commentsWithoutAuthorKey" | "knownUniqueAuthorCount" | "authorCoverageRate" | "commentsPerKnownAuthor" | "topAuthorCommentShare"
> {
  const authorCounts = new Map<string, number>();
  let withKey = 0;
  let withoutKey = 0;
  for (const id of new Set(params.matchedCommentIds)) {
    const key = params.commentToAuthorKey.get(id);
    if (key) {
      withKey++;
      authorCounts.set(key, (authorCounts.get(key) ?? 0) + 1);
    } else {
      withoutKey++;
    }
  }
  const commentCount = withKey + withoutKey;
  const knownUniqueAuthorCount = withKey > 0 ? authorCounts.size : commentCount > 0 ? 0 : null;
  const topCount = Math.max(0, ...authorCounts.values());

  return {
    commentsWithAuthorKey: withKey,
    commentsWithoutAuthorKey: withoutKey,
    knownUniqueAuthorCount,
    authorCoverageRate: commentCount > 0 ? Math.round((withKey / commentCount) * 100) / 100 : null,
    commentsPerKnownAuthor: knownUniqueAuthorCount ? Math.round((withKey / knownUniqueAuthorCount) * 100) / 100 : null,
    topAuthorCommentShare: withKey > 0 ? Math.round((topCount / withKey) * 100) / 100 : null,
  };
}

/** 독자용 화면에 고유 작성자 수를 얼마나 강하게(정상 표시/보조 표시/숨김) 보여줄지 판단.
 * "얼마나 확신 있게 보여줄까"를 authorCoverageRate 하나로 정한다 - section 6 규칙 그대로. */
export type AuthorMetricDisplayLevel = "full" | "muted" | "hidden";

export function authorMetricDisplayLevel(coverage: Pick<SupportingCoverage, "commentsWithAuthorKey" | "authorCoverageRate">): AuthorMetricDisplayLevel {
  if (coverage.commentsWithAuthorKey < 5) return "hidden";
  if (coverage.authorCoverageRate === null) return "hidden";
  if (coverage.authorCoverageRate >= 0.8) return "full";
  if (coverage.authorCoverageRate >= 0.5) return "muted";
  return "hidden";
}

/** section 5 - 소수 authorKey가 댓글 수를 부풀리고 있는지 경고. authorKey는 노출하지 않는다. */
export function computeAuthorConcentrationWarnings(
  perInsight: { headline: string; coverage: SupportingCoverage }[]
): string[] {
  const warnings: string[] = [];
  for (const { headline, coverage } of perInsight) {
    if (coverage.commentsWithAuthorKey < 5) continue; // 표본이 너무 작으면 판단하지 않는다
    if (coverage.topAuthorCommentShare !== null && coverage.topAuthorCommentShare >= 0.2) {
      warnings.push(
        `AUTHOR CONCENTRATION WARNING — "${headline}" 인사이트는 작성자 1명이 관련 댓글의 ${Math.round(coverage.topAuthorCommentShare * 100)}%를 차지합니다.`
      );
    } else if (
      coverage.knownUniqueAuthorCount !== null &&
      coverage.commentsWithAuthorKey >= 10 &&
      coverage.knownUniqueAuthorCount / coverage.commentsWithAuthorKey <= 0.3
    ) {
      warnings.push(
        `AUTHOR CONCENTRATION WARNING — "${headline}" 인사이트는 댓글 ${coverage.commentsWithAuthorKey}건에 비해 고유 작성자가 ${coverage.knownUniqueAuthorCount}명으로 적습니다.`
      );
    }
  }
  return warnings;
}

const STRENGTH_ORDER = ["LOW", "MEDIUM", "HIGH"] as const;
type Strength = (typeof STRENGTH_ORDER)[number];

/** 댓글 수가 많아도 소수 authorKey가 반복 작성한 것이면 근거 강도를 자동으로 올리지 않는다
 * (section 7) - computeAuthorConcentrationWarnings와 같은 기준을 재사용해 한 단계 낮춘다.
 * 작성자 식별 표본이 너무 적어(authorMetricDisplayLevel !== "full") 판단할 수 없으면 그대로 둔다. */
export function adjustEvidenceStrengthForAuthorConcentration(
  baseStrength: Strength,
  coverage: Pick<SupportingCoverage, "commentsWithAuthorKey" | "authorCoverageRate" | "topAuthorCommentShare" | "knownUniqueAuthorCount">
): Strength {
  if (authorMetricDisplayLevel(coverage) !== "full") return baseStrength;
  const concentrated =
    (coverage.topAuthorCommentShare !== null && coverage.topAuthorCommentShare >= 0.2) ||
    (coverage.knownUniqueAuthorCount !== null &&
      coverage.commentsWithAuthorKey >= 10 &&
      coverage.knownUniqueAuthorCount / coverage.commentsWithAuthorKey <= 0.3);
  if (!concentrated) return baseStrength;
  const idx = STRENGTH_ORDER.indexOf(baseStrength);
  return STRENGTH_ORDER[Math.max(0, idx - 1)];
}

export type CoverageAudit = {
  authorMetricStatus: AuthorMetricStatus;
  totalContentsAnalyzed: number;
  totalCommentsAnalyzed: number;
  // "최종 리포트에 대표 Evidence로 인용된" 콘텐츠/댓글 수 - 구조적으로 evidenceIds만 보고 센 것.
  // 실제로 패턴이 반복된 범위(broader)와는 다르다 - 아래 contentsMatchedToAnyPattern 참고.
  contentsReferencedInFinalReport: number;
  commentsReferencedInFinalReport: number;
  unassignedContentCount: number; // 어떤 insight의 대표 Evidence에도 인용되지 않은 콘텐츠 수
  unassignedCommentCount: number;
  // runCoverageClassification이 전체 댓글을 다시 훑어 "이 패턴과 일치"로 판정한 콘텐츠의 합집합.
  // contentsReferencedInFinalReport의 상위 집합이어야 정상(대표 사례는 항상 매칭 집합에 포함).
  contentsMatchedToAnyPattern: number;
  // 어떤 패턴에도 매칭되지 않았지만 댓글 자체는 존재하는 콘텐츠 - Baseline/Stability 후보 풀.
  contentsWithOnlyBaselineReactions: number;
  // 댓글이 아예 수집되지 않아 애초에 판단 근거가 없는 콘텐츠(패턴이 없는 게 아니라 데이터가 없는 것).
  contentsExcludedByLowEvidence: number;
  // editorial_pass가 중복 제거하며 대표 증거에서 완전히 빠진 콘텐츠 수(pipeline.ts가
  // 편집 전/후 evidenceIds를 diff해 계산 - lib/coverage-audit.ts 자체는 계산하지 않는다).
  contentsDroppedDuringEditorialSelection: number;
  // 두 개 이상의 콘텐츠에서 반복되는 것으로 확인된 최종 insight 수 (broad_repeated + 일부 concentrated).
  crossContentRepeatCount: number;
  // 최종 insight들의 대표 Evidence가 인용한 콘텐츠 중, 상위 15%에 해당하는 콘텐츠가 전체 인용의
  // 몇 %를 차지하는지 (0~1). 높을수록 소수 콘텐츠에 근거가 몰려 있다는 뜻.
  evidenceConcentration: number;
  topContentEvidenceShare: number; // 가장 많이 인용된 단일 콘텐츠 하나가 차지하는 인용 비율 (0~1)
  topContentVideoId: string | null;
  concentrationWarnings: string[];
  dataCoverageNote: string;
};

export type CoverageAuditVideoStat = { videoId: string; commentCount: number };

/** evidenceIds(댓글 ID) 배열에서 실제 존재하는 댓글만 걸러 video_id로 변환. 샘플 밖 ID나
 * 모델이 잘못 인용한 ID는 조용히 버린다(evidence-resolve.ts의 buildEvidencePackage와 동일 원칙). */
function resolveVideoIds(evidenceIds: string[], commentToVideo: Map<string, string | null>): Set<string> {
  const out = new Set<string>();
  for (const id of evidenceIds) {
    const videoId = commentToVideo.get(id);
    if (videoId) out.add(videoId);
  }
  return out;
}

/** 대표 Evidence(evidenceIds)만 보고 계산하는 구조적 통계. LLM의 supportingCoverage 판정이
 * 아직 없어도(=구버전 job) 이 값들은 항상 계산 가능하다. */
export function computeStructuralCoverage(params: {
  insights: StructuredInsight[];
  commentToVideo: Map<string, string | null>;
  allVideoIds: string[];
  allCommentIds: string[];
  videoCommentCounts: Map<string, number>; // videoId -> 그 영상에서 수집된 댓글 수
}): Pick<
  CoverageAudit,
  | "totalContentsAnalyzed"
  | "totalCommentsAnalyzed"
  | "contentsReferencedInFinalReport"
  | "commentsReferencedInFinalReport"
  | "unassignedContentCount"
  | "unassignedCommentCount"
  | "contentsExcludedByLowEvidence"
  | "evidenceConcentration"
  | "topContentEvidenceShare"
  | "topContentVideoId"
> {
  const referencedVideoIds = new Set<string>();
  const referencedCommentIds = new Set<string>();
  const evidenceCountByVideo = new Map<string, number>();

  for (const ins of params.insights) {
    const ids = Array.isArray(ins.evidenceIds) ? ins.evidenceIds : [];
    for (const id of ids) {
      const videoId = params.commentToVideo.get(id);
      if (!videoId) continue; // 존재하지 않는/샘플 밖 ID
      referencedCommentIds.add(id);
      referencedVideoIds.add(videoId);
      evidenceCountByVideo.set(videoId, (evidenceCountByVideo.get(videoId) ?? 0) + 1);
    }
  }

  const totalContentsAnalyzed = params.allVideoIds.length;
  const totalCommentsAnalyzed = params.allCommentIds.length;
  const contentsExcludedByLowEvidence = params.allVideoIds.filter(
    (v) => (params.videoCommentCounts.get(v) ?? 0) === 0
  ).length;

  // 집중도: 인용 횟수 기준 상위 15%(최소 1개) 콘텐츠가 전체 인용의 몇 %를 차지하는가.
  const sortedByEvidence = [...evidenceCountByVideo.entries()].sort((a, b) => b[1] - a[1]);
  const totalEvidenceCitations = sortedByEvidence.reduce((sum, [, c]) => sum + c, 0);
  const topN = Math.max(1, Math.ceil(sortedByEvidence.length * 0.15));
  const topShare =
    totalEvidenceCitations > 0
      ? sortedByEvidence.slice(0, topN).reduce((sum, [, c]) => sum + c, 0) / totalEvidenceCitations
      : 0;
  const topSingle = sortedByEvidence[0];
  const topContentEvidenceShare = totalEvidenceCitations > 0 && topSingle ? topSingle[1] / totalEvidenceCitations : 0;

  return {
    totalContentsAnalyzed,
    totalCommentsAnalyzed,
    contentsReferencedInFinalReport: referencedVideoIds.size,
    commentsReferencedInFinalReport: referencedCommentIds.size,
    unassignedContentCount: Math.max(0, totalContentsAnalyzed - referencedVideoIds.size),
    unassignedCommentCount: Math.max(0, totalCommentsAnalyzed - referencedCommentIds.size),
    contentsExcludedByLowEvidence,
    evidenceConcentration: Math.round(topShare * 100) / 100,
    topContentEvidenceShare: Math.round(topContentEvidenceShare * 100) / 100,
    topContentVideoId: topSingle ? topSingle[0] : null,
  };
}

/** section 5 기준 그대로 - 자동으로 "그러니 문제다"라고 결론짓지 않고, 기준을 넘었다는
 * 사실만 경고로 남긴다. 검토(정당한 집중인지)는 사람 또는 이후 LLM 판단의 몫. */
export function computeConcentrationWarnings(params: {
  evidenceConcentration: number;
  topContentEvidenceShare: number;
  totalContentsAnalyzed: number;
  contentsReferencedInFinalReport: number;
  insightsDominatedBySameVideo: { videoId: string; insightHeadlines: string[] }[];
}): string[] {
  const warnings: string[] = [];
  const topSharePct = Math.round(params.evidenceConcentration * 100);
  const referencedSharePct =
    params.totalContentsAnalyzed > 0
      ? Math.round((params.contentsReferencedInFinalReport / params.totalContentsAnalyzed) * 100)
      : 0;

  if (params.evidenceConcentration >= 0.6 && referencedSharePct <= 15) {
    warnings.push(
      `최종 Evidence의 ${topSharePct}%가 전체 콘텐츠의 ${referencedSharePct}%에 집중되어 있습니다.`
    );
  }
  for (const group of params.insightsDominatedBySameVideo) {
    if (group.insightHeadlines.length >= 3) {
      warnings.push(
        `콘텐츠 1건(${group.videoId})이 서로 다른 인사이트 ${group.insightHeadlines.length}건의 핵심 근거를 동시에 지배하고 있습니다.`
      );
    }
  }
  return warnings;
}

/** 사실만 채워 넣는 템플릿 - "안정적으로 소비됐다"류 해석은 여기서 자동으로 붙이지 않는다.
 * 그런 해석이 정당화되는 경우(baseline insight 승격 조건 충족)에만 별도 insight로 승격되고,
 * 그 결과가 여기 노트에 한 줄 반영될 뿐이다. */
export function buildDataCoverageNote(params: {
  totalContentsAnalyzed: number;
  totalCommentsAnalyzed: number;
  finalInsightCount: number;
  contentsReferencedInFinalReport: number;
  contentsMatchedToAnyPattern: number;
  baselineInsightAdded: boolean;
}): string {
  const parts: string[] = [
    `${params.totalContentsAnalyzed}개 콘텐츠와 ${params.totalCommentsAnalyzed}건의 댓글을 분석했습니다.`,
    `최종 리포트는 반복성과 의사결정 가치가 확인된 ${params.finalInsightCount}개 패턴을 중심으로 구성했습니다.`,
  ];
  if (params.contentsReferencedInFinalReport < params.contentsMatchedToAnyPattern) {
    parts.push(
      `대표 Evidence로 노출된 콘텐츠는 ${params.contentsReferencedInFinalReport}개지만, 같은 패턴이 확인된 콘텐츠는 ${params.contentsMatchedToAnyPattern}개입니다 - 각 인사이트의 실제 적용 범위는 SCOPE 표시를 참고하세요.`
    );
  } else {
    parts.push(`대표 Evidence로 노출된 콘텐츠(${params.contentsReferencedInFinalReport}개)가 곧 이 패턴들이 확인된 전체 범위입니다.`);
  }
  if (params.baselineInsightAdded) {
    parts.push(`나머지 콘텐츠에서 반복되는 안정적 패턴은 별도 인사이트로 포함했습니다.`);
  }
  return parts.join(" ");
}
