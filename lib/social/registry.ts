import { youtubeVideoAdapter } from "./adapters/youtubeVideoAdapter";
import { youtubeChannelAdapter } from "./adapters/youtubeChannelAdapter";
import { instagramAdapter } from "./adapters/instagramAdapter";
import { importedDatasetAdapter } from "./adapters/importedDatasetAdapter";
import type { SourceAdapter, SourceType } from "./types";

/** 모든 SourceType이 반드시 여기 매핑되어야 한다 - pipeline.ts는 이 registry를 통해서만
 * 어댑터를 얻고, 플랫폼 이름으로 분기하지 않는다. voc_dataset/review_dataset은 "이미 매핑된
 * 행을 그대로 Content/Reaction으로 나눈다"는 동작이 imported_dataset과 동일해 같은 어댑터를
 * 재사용한다(구분은 sources.source_type/데이터 출처 라벨링에만 쓰인다). */
export const sourceRegistry: Record<SourceType, SourceAdapter> = {
  youtube_video: youtubeVideoAdapter,
  youtube_channel: youtubeChannelAdapter,
  instagram_post: instagramAdapter,
  instagram_reel: instagramAdapter,
  instagram_profile: instagramAdapter,
  imported_dataset: importedDatasetAdapter,
  voc_dataset: importedDatasetAdapter,
  review_dataset: importedDatasetAdapter,
};

const URL_ADAPTERS: SourceAdapter[] = [youtubeVideoAdapter, youtubeChannelAdapter, instagramAdapter];

/** 사용자가 붙여넣은 URL 하나를 보고 어떤 어댑터가 처리할지 찾는다 (Instant Intelligence
 * "링크 붙여넣기" 진입점 전용). 여러 어댑터가 동시에 매칭되면 안 되므로 순서상 첫 매치를 쓴다. */
export function findAdapterForUrl(url: string): SourceAdapter | null {
  return URL_ADAPTERS.find((a) => a.matches(url)) ?? null;
}
