import { stripLeadingHeading } from "../pdf/markdown";
import type { LegacyBlock } from "./reportSchema";

/** 구버전(자유 마크다운) job의 job_analysis_modules row를 받아 섹션 단위 블록으로 변환한다.
 * 신규 스키마 job은 parseStoredModuleContent가 성공하므로 이 어댑터를 타지 않는다 - 여기 오는
 * 것은 전부 "구조화되지 않은 순수 마크다운"이다. 매핑 실패한 원문은 rawFallback에만 담아
 * 첫 화면 기본 렌더링에는 노출하지 않는다("전체 분석 보기"에서만 접근). */
export function adaptLegacyModules(
  modules: { module_key: string; title: string | null; content_md: string }[]
): { blocks: LegacyBlock[]; rawFallback: string } {
  const blocks: LegacyBlock[] = [];
  const rawParts: string[] = [];

  for (const m of modules) {
    const content = (m.content_md ?? "").trim();
    if (!content || content.startsWith("{")) continue; // 신규 구조화 콘텐츠는 여기서 다루지 않음
    const body = stripLeadingHeading(content).trim();
    if (!body) continue;
    blocks.push({ moduleKey: m.module_key, title: m.title || m.module_key, markdown: body });
    rawParts.push(`## ${m.title || m.module_key}\n\n${body}`);
  }

  return { blocks, rawFallback: rawParts.join("\n\n---\n\n") };
}
