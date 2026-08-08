import Anthropic from "@anthropic-ai/sdk";
import { createMessageWithCorruptionRetry } from "./claude";
import type { CommentSampleItem } from "./aggregate";

let client: Anthropic | null = null;
function anthropic() {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY가 설정되지 않았습니다.");
    client = new Anthropic({ apiKey });
  }
  return client;
}

export type IpType = "person" | "group" | "brand" | "product" | "service" | "content" | "place";

export type IpTypeInfo = {
  type: IpType;
  typeLabel: string; // "인물", "그룹", "브랜드", "제품", "서비스", "콘텐츠", "공간" 등
  audienceTerm: string; // "시청자", "소비자", "사용자", "방문자" 등 이 IP에 맞는 대중 지칭어
  identityTerm: string; // "캐릭터/페르소나", "브랜드 정체성", "제품 정체성" 등 이 IP에서 "정체성"을 부르는 말
};

const SCHEMA = {
  name: "record_ip_type",
  description: "분석 대상(IP)의 유형을 판별하고, 리포트 전체에서 사용할 지칭어를 기록한다.",
  input_schema: {
    type: "object" as const,
    properties: {
      type: {
        type: "string" as const,
        enum: ["person", "group", "brand", "product", "service", "content", "place"],
        description:
          "person=개인(연예인/크리에이터/인플루언서), group=그룹/팀/조직, brand=브랜드/기업, product=제품/상품, service=서비스/앱/플랫폼, content=콘텐츠/채널/영화/드라마/게임/캐릭터, place=공간/매장/지역/캠페인",
      },
      type_label: { type: "string" as const, description: '한국어 유형명. 예: "인물", "그룹", "브랜드", "제품", "서비스", "콘텐츠", "공간"' },
      audience_term: {
        type: "string" as const,
        description: '이 IP에 대해 반응하는 대중을 부를 가장 자연스러운 한국어 단어 하나. 예: "시청자", "팬", "소비자", "사용자", "방문자", "구매자"',
      },
      identity_term: {
        type: "string" as const,
        description: '이 IP의 "정체성/이미지"를 부를 가장 자연스러운 한국어 표현. 예: "캐릭터", "브랜드 이미지", "제품 정체성", "서비스 경험", "콘텐츠 정체성"',
      },
    },
    required: ["type", "type_label", "audience_term", "identity_term"],
  },
};

export const FALLBACK_IP_TYPE: IpTypeInfo = {
  type: "content",
  typeLabel: "콘텐츠/IP",
  audienceTerm: "대중",
  identityTerm: "정체성",
};

export async function classifyIpType(keyword: string, sample: CommentSampleItem[]): Promise<IpTypeInfo> {
  try {
    const res = await createMessageWithCorruptionRetry(anthropic(), {
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      tools: [SCHEMA],
      tool_choice: { type: "tool", name: "record_ip_type" },
      messages: [
        {
          role: "user",
          content: `분석 대상(IP): "${keyword}"

아래는 이 IP에 대한 실제 댓글/게시물 샘플 일부다. 이것만 보고 이 IP가 사람인지, 그룹인지, 브랜드인지,
제품인지, 서비스인지, 콘텐츠(방송/영화/게임/캐릭터 등)인지, 공간/캠페인인지 판별하라.
확실하지 않으면 텍스트에서 가장 많이 암시되는 유형으로 판단하라.

[샘플 (최대 15건)]
${JSON.stringify(sample.slice(0, 15).map((s) => s.text), null, 2)}`,
        },
      ],
    });
    const toolUse = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (!toolUse) return FALLBACK_IP_TYPE;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const input = toolUse.input as any;
    return {
      type: input.type ?? FALLBACK_IP_TYPE.type,
      typeLabel: input.type_label ?? FALLBACK_IP_TYPE.typeLabel,
      audienceTerm: input.audience_term ?? FALLBACK_IP_TYPE.audienceTerm,
      identityTerm: input.identity_term ?? FALLBACK_IP_TYPE.identityTerm,
    };
  } catch (err) {
    console.error("[classifyIpType] 분류 실패, 기본값 사용:", err);
    return FALLBACK_IP_TYPE;
  }
}
