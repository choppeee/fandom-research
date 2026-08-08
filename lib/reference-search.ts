import Anthropic from "@anthropic-ai/sdk";
import { createMessageWithCorruptionRetry } from "./claude";

let client: Anthropic | null = null;
function anthropic() {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY가 설정되지 않았습니다.");
    client = new Anthropic({ apiKey });
  }
  return client;
}

export type ReferenceCategory = "academic" | "context";

export type ValidatedReference = {
  title: string;
  url: string;
  snippet: string;
  connectionNote: string;
  category: ReferenceCategory;
};

const ACADEMIC_DOMAIN_PATTERNS = [
  /\.ac\.kr/i,
  /kci\.go\.kr/i,
  /riss\.kr/i,
  /dbpia\.co\.kr/i,
  /kiss\.kstudy\.com/i,
  /earticle\.net/i,
  /koreascience\.kr/i,
  /scholar\.google/i,
  /jstor\.org/i,
  /sciencedirect\.com/i,
  /springer\.com/i,
  /tandfonline\.com/i,
  /sagepub\.com/i,
  /researchgate\.net/i,
  /ncbi\.nlm\.nih\.gov/i,
  /\.edu\b/i,
  /dcollection\./i,
];

/** 학술/연구기관 도메인 패턴이면 academic, 그 외(공식 프로필/기사/위키 등)는 context로 분류.
 * 별도 LLM 호출 없이 URL 패턴으로만 판별해 나무위키 등 일반 자료가 학술 근거처럼 보이지 않게 한다. */
function classifyCategory(url: string): ReferenceCategory {
  return ACADEMIC_DOMAIN_PATTERNS.some((re) => re.test(url)) ? "academic" : "context";
}

/**
 * 실제 웹 검색(Claude의 서버사이드 web_search 도구)으로 찾은 자료만 레퍼런스로 채택한다.
 * "Search/Retrieval → Validation → Analysis" 순서를 지키기 위해,
 * URL은 모델이 생성한 텍스트가 아니라 API가 반환한 citation 객체에서만 추출한다.
 * 검색 도구를 쓸 수 없거나(계정 미지원 등) 결과가 없으면 빈 배열을 반환하고,
 * 상위 파이프라인은 이 경우 레퍼런스 섹션 자체를 생략해야 한다(hallucination 방지 원칙).
 */
export async function searchValidatedReferences(params: {
  keyword: string;
  focusAreas: string[];
}): Promise<ValidatedReference[]> {
  if (params.focusAreas.length === 0) return [];

  try {
    const res = await createMessageWithCorruptionRetry(anthropic(), {
      model: "claude-sonnet-5",
      max_tokens: 2000,
      // 서버사이드 웹 검색 도구. 계정/플랜에 따라 사용 불가할 수 있으며,
      // 그 경우 아래 catch에서 빈 배열로 안전하게 폴백한다.
      tools: [
        {
          type: "web_search_20250305",
          name: "web_search",
          max_uses: 5,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
      ],
      messages: [
        {
          role: "user",
          content: `"${params.keyword}" 관련 리서치에서 아래 주제들을 뒷받침할 수 있는 실제 자료를 웹 검색으로 찾아라:
${params.focusAreas.map((f, i) => `${i + 1}. ${f}`).join("\n")}

우선순위: 1) 학술 논문(DOI/공식 학술 페이지) 2) 대학/연구기관 3) 산업 보고서 4) 신뢰할 수 있는 전문 매체.
검색으로 실제 확인된 자료만 언급하고, 확인되지 않으면 그 주제는 건너뛰어라. 자료를 없는데 지어내지 마라.
각 자료마다 왜 이 분석과 관련 있는지 한국어로 한 문장 설명을 덧붙여라.`,
        },
      ],
    });

    const refs: ValidatedReference[] = [];
    const seen = new Set<string>();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const block of res.content as any[]) {
      if (block?.type !== "text" || !Array.isArray(block.citations)) continue;
      for (const citation of block.citations) {
        if (citation?.type !== "web_search_result_location") continue;
        const url: string | undefined = citation.url;
        if (!url || seen.has(url)) continue;
        seen.add(url);
        refs.push({
          title: citation.title || url,
          url,
          snippet: String(citation.cited_text ?? "").slice(0, 300),
          connectionNote: String(block.text ?? "").slice(0, 300),
          category: classifyCategory(url),
        });
      }
    }

    return refs.slice(0, 8);
  } catch (err) {
    console.error("[reference-search] 웹 검색 실패 - 레퍼런스 없이 진행:", err);
    return [];
  }
}
