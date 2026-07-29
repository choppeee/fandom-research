import type { PlatformCollector } from "./types";
import { youtubeCollector } from "./youtube";
import { xCollector } from "./x";

export * from "./types";
export { youtubeCollector } from "./youtube";
export { xCollector } from "./x";

/** 새 플랫폼을 추가할 때는 여기 배열에만 등록하면 된다. */
export const ALL_COLLECTORS: PlatformCollector[] = [youtubeCollector, xCollector];

export function getCollector(platform: "youtube" | "x"): PlatformCollector {
  const found = ALL_COLLECTORS.find((c) => c.platform === platform);
  if (!found) throw new Error(`알 수 없는 플랫폼: ${platform}`);
  return found;
}
