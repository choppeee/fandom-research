"use client";

import { useState } from "react";
import type { CommentEvidence, EvidencePackage } from "@/lib/evidence-types";
import { VideoEvidenceCard } from "./VideoEvidenceCard";
import { CommentCollage } from "./CommentCollage";
import { CommentEvidenceCard } from "./CommentEvidenceCard";
import { EvidenceDrawer } from "./EvidenceDrawer";

/** EvidencePackage.visualRecommendation에 따라 알맞은 시각자료 컴포넌트를 고른다.
 * 근거가 없으면(no_visual) 아무것도 렌더링하지 않는다 - 억지로 빈 카드를 채우지 않는다. */
export function VisualInsightBlock({ pkg, insightHeadline }: { pkg: EvidencePackage; insightHeadline: string }) {
  const [selected, setSelected] = useState<CommentEvidence | null>(null);

  if (pkg.visualRecommendation === "no_visual") return null;

  return (
    <div className="space-y-3">
      {pkg.visualRecommendation === "hero_video" && pkg.supportingVideos[0] && (
        <>
          <VideoEvidenceCard video={pkg.supportingVideos[0]} defaultEmbedded={false} />
          {pkg.supportingVideos[0].representativeComments.map((c) => (
            <CommentEvidenceCard key={c.commentId} comment={c} onSelectEvidence={setSelected} />
          ))}
        </>
      )}

      {pkg.visualRecommendation === "comment_collage" && (
        <>
          <CommentCollage pkg={pkg} onSelectEvidence={setSelected} />
          {pkg.supportingVideos.length > 0 && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {pkg.supportingVideos.slice(0, 2).map((v) => (
                <VideoEvidenceCard key={v.videoId} video={v} />
              ))}
            </div>
          )}
        </>
      )}

      {pkg.visualRecommendation === "quote_card" && (
        <div className="space-y-2">
          {pkg.supportingComments.slice(0, 2).map((c) => (
            <CommentEvidenceCard key={c.commentId} comment={c} onSelectEvidence={setSelected} />
          ))}
          {pkg.supportingVideos[0] && <VideoEvidenceCard video={pkg.supportingVideos[0]} />}
        </div>
      )}

      {(pkg.repetitionSummary || pkg.engagementSummary) && (
        <p className="text-[11px] text-muted-foreground">
          {[pkg.repetitionSummary, pkg.engagementSummary].filter(Boolean).join(" · ")}
        </p>
      )}

      <EvidenceDrawer
        comment={selected}
        insightHeadline={insightHeadline}
        related={pkg.supportingComments}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
