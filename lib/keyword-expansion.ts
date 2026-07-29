import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;
function anthropic() {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY가 설정되지 않았습니다.");
    client = new Anthropic({ apiKey });
  }
  return client;
}

const EXPAND_TOOL_SCHEMA = {
  name: "record_search_variants",
  description: "키워드(IP명)를 실제 온라인에서 지칭하는 대체 표현으로 확장한다.",
  input_schema: {
    type: "object" as const,
    properties: {
      variants: {
        type: "array" as const,
        items: { type: "string" as const },
        description: "동일 대상을 가리키는 표현 3~6개 (본명/영문명/그룹+이름/팬덤 애칭 등). 원래 키워드 자체는 포함하지 않는다.",
      },
    },
    required: ["variants"],
  },
};

/**
 * 키워드 하나를 실제 검색에 쓰기 좋은 확장 쿼리로 변환한다.
 * 실패하거나 API 키가 없으면 원래 키워드만 사용하는 쿼리로 안전하게 폴백한다.
 */
export async function expandSearchQuery(keyword: string, platform: "x" | "web"): Promise<string> {
  let variants: string[] = [];

  try {
    const res = await anthropic().messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      tools: [EXPAND_TOOL_SCHEMA],
      tool_choice: { type: "tool", name: "record_search_variants" },
      messages: [
        {
          role: "user",
          content: `"${keyword}"는 유튜브/SNS에서 언급되는 인물/그룹/브랜드/콘텐츠일 수 있는 검색 키워드입니다.
이 대상을 실제로 온라인에서 지칭할 때 쓰이는 다른 표현(영문 표기, 그룹명+이름 조합, 흔히 쓰이는 팬덤 애칭 등)을
record_search_variants 도구로 최대 6개까지 제시하세요. 확실하지 않으면 억지로 만들지 말고 적게 반환하세요.`,
        },
      ],
    });
    const toolUse = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    const input = toolUse?.input as { variants?: unknown } | undefined;
    if (input && Array.isArray(input.variants)) {
      variants = input.variants.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
    }
  } catch {
    // 확장 실패 시 원래 키워드만으로 검색 (기능 자체는 계속 동작해야 함)
    variants = [];
  }

  const terms = [keyword, ...variants].map((t) => `"${t}"`);
  const orQuery = terms.length > 1 ? `(${terms.join(" OR ")})` : terms[0];

  if (platform === "x") {
    // 리트윗 제외, 링크만 있는 스팸성 게시물 과다 유입 방지를 위한 기본 필터
    return `${orQuery} -is:retweet`;
  }
  return orQuery;
}
