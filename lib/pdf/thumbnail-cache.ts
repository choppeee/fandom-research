/** YouTube 썸네일을 서버에서 fetch해 PDF에 base64로 임베드한다.
 * 외부 요청 실패가 리포트 전체를 실패시키면 안 되므로, 실패 시 null을 반환하고
 * 호출부(pdf/evidence-blocks.ts)가 텍스트형 카드로 graceful fallback한다. */

// maxresdefault는 없는 영상이 많아 404가 잦다. hqdefault는 거의 항상 존재.
const RESOLUTIONS = ["hqdefault", "mqdefault", "default"] as const;

async function fetchAsDataUri(url: string, timeoutMs = 6000): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength < 200) return null; // YouTube는 썸네일이 없을 때도 200과 함께 회색 1x1류 더미를 주기도 함
    return `data:${contentType};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

/** cache는 하나의 PDF 렌더 요청 동안 같은 videoId를 여러 insight가 참조할 때 중복 fetch를 막는다. */
export async function resolveYoutubeThumbnail(videoId: string, cache: Map<string, string | null>): Promise<string | null> {
  if (cache.has(videoId)) return cache.get(videoId) ?? null;
  for (const resolution of RESOLUTIONS) {
    const uri = await fetchAsDataUri(`https://i.ytimg.com/vi/${videoId}/${resolution}.jpg`);
    if (uri) {
      cache.set(videoId, uri);
      return uri;
    }
  }
  cache.set(videoId, null);
  return null;
}
