import Anthropic from "@anthropic-ai/sdk";
import { IP_INTELLIGENCE_SYSTEM_PROMPT } from "./ip-intelligence-prompt";

let client: Anthropic | null = null;
function anthropic() {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY가 설정되지 않았습니다.");
    client = new Anthropic({ apiKey });
  }
  return client;
}

export type VisualData = {
  ipLabel: string;
  diagnostic: {
    strongAssets: { label: string; evidence: string }[];
    hiddenAssets: { label: string; evidence: string }[];
    weakSignals: { label: string; evidence: string }[];
    risks: { label: string; evidence: string }[];
  };
  funnel: {
    stages: {
      stage: "Discovery" | "Attention" | "Interest" | "Affinity" | "Conversion" | "Advocacy";
      trigger: string | null;
      dropoff: string | null;
      strength: "high" | "medium" | "low" | "unknown";
    }[];
  };
  characterArchitecture: {
    applicable: boolean;
    layers: { layer: "CORE" | "CONTRAST" | "RELATIONSHIP" | "VIRAL"; label: string; evidence: string }[];
  };
  opportunityMatrix: {
    points: { label: string; massAudienceExpansion: number; evidenceStrength: number; note: string }[];
  };
  perceptionMap: {
    axes: { leftLabel: string; rightLabel: string; position: number; note: string }[];
  };
  opportunityMap: {
    keep: { label: string; evidence: string }[];
    discover: { label: string; evidence: string }[];
    create: { label: string; evidence: string }[];
  };
};

const SCHEMA = {
  name: "record_visual_data",
  description: "PDF 시각화 페이지(진단 대시보드/퍼널/캐릭터 구조/기회 매트릭스)에 쓸 구조화 데이터를 기록한다.",
  input_schema: {
    type: "object" as const,
    properties: {
      ip_label: {
        type: "string" as const,
        description: "이 IP를 부르는 말 (예: 인물, 그룹, 브랜드, 콘텐츠, 제품 등 - 분석 대상에 맞게)",
      },
      diagnostic: {
        type: "object" as const,
        properties: {
          strong_assets: { type: "array" as const, items: { type: "object" as const, properties: { label: { type: "string" as const }, evidence: { type: "string" as const } }, required: ["label", "evidence"] } },
          hidden_assets: { type: "array" as const, items: { type: "object" as const, properties: { label: { type: "string" as const }, evidence: { type: "string" as const } }, required: ["label", "evidence"] } },
          weak_signals: { type: "array" as const, items: { type: "object" as const, properties: { label: { type: "string" as const }, evidence: { type: "string" as const } }, required: ["label", "evidence"] } },
          risks: { type: "array" as const, items: { type: "object" as const, properties: { label: { type: "string" as const }, evidence: { type: "string" as const } }, required: ["label", "evidence"] } },
        },
        required: ["strong_assets", "hidden_assets", "weak_signals", "risks"],
      },
      funnel: {
        type: "object" as const,
        properties: {
          stages: {
            type: "array" as const,
            items: {
              type: "object" as const,
              properties: {
                stage: { type: "string" as const, enum: ["Discovery", "Attention", "Interest", "Affinity", "Conversion", "Advocacy"] },
                trigger: { type: ["string", "null"] as unknown as "string" },
                dropoff: { type: ["string", "null"] as unknown as "string" },
                strength: { type: "string" as const, enum: ["high", "medium", "low", "unknown"] },
              },
              required: ["stage", "trigger", "dropoff", "strength"],
            },
          },
        },
        required: ["stages"],
      },
      character_architecture: {
        type: "object" as const,
        properties: {
          applicable: { type: "boolean" as const, description: "인물/그룹처럼 캐릭터 구조 분석이 데이터로 뒷받침되면 true" },
          layers: {
            type: "array" as const,
            items: {
              type: "object" as const,
              properties: {
                layer: { type: "string" as const, enum: ["CORE", "CONTRAST", "RELATIONSHIP", "VIRAL"] },
                label: { type: "string" as const },
                evidence: { type: "string" as const },
              },
              required: ["layer", "label", "evidence"],
            },
          },
        },
        required: ["applicable", "layers"],
      },
      opportunity_matrix: {
        type: "object" as const,
        properties: {
          points: {
            type: "array" as const,
            items: {
              type: "object" as const,
              properties: {
                label: { type: "string" as const },
                mass_audience_expansion: { type: "number" as const, description: "0-100, 대중 확장 잠재력" },
                evidence_strength: { type: "number" as const, description: "0-100, 근거 강도" },
                note: { type: "string" as const },
              },
              required: ["label", "mass_audience_expansion", "evidence_strength", "note"],
            },
          },
        },
        required: ["points"],
      },
      perception_map: {
        type: "object" as const,
        properties: {
          axes: {
            type: "array" as const,
            items: {
              type: "object" as const,
              properties: {
                left_label: { type: "string" as const },
                right_label: { type: "string" as const },
                position: { type: "number" as const, description: "0(왼쪽 끝)~100(오른쪽 끝), 현재 위치" },
                note: { type: "string" as const },
              },
              required: ["left_label", "right_label", "position", "note"],
            },
          },
        },
        required: ["axes"],
      },
      opportunity_map: {
        type: "object" as const,
        properties: {
          keep: { type: "array" as const, items: { type: "object" as const, properties: { label: { type: "string" as const }, evidence: { type: "string" as const } }, required: ["label", "evidence"] } },
          discover: { type: "array" as const, items: { type: "object" as const, properties: { label: { type: "string" as const }, evidence: { type: "string" as const } }, required: ["label", "evidence"] } },
          create: { type: "array" as const, items: { type: "object" as const, properties: { label: { type: "string" as const }, evidence: { type: "string" as const } }, required: ["label", "evidence"] } },
        },
        required: ["keep", "discover", "create"],
      },
    },
    required: [

      "ip_label",
      "diagnostic",
      "funnel",
      "character_architecture",
      "opportunity_matrix",
      "perception_map",
      "opportunity_map",
    ],
  },
};

const EMPTY: VisualData = {
  ipLabel: "IP",
  diagnostic: { strongAssets: [], hiddenAssets: [], weakSignals: [], risks: [] },
  funnel: { stages: [] },
  characterArchitecture: { applicable: false, layers: [] },
  opportunityMatrix: { points: [] },
  perceptionMap: { axes: [] },
  opportunityMap: { keep: [], discover: [], create: [] },
};

export async function extractVisualData(params: {
  keyword: string;
  modules: { title: string; content: string }[];
}): Promise<VisualData> {
  if (params.modules.length === 0) return EMPTY;

  const prompt = `분석 대상(IP): "${params.keyword}"

아래는 이미 완료된 심층 분석 모듈들이다. 이 내용에 실제로 근거가 있는 항목만 record_visual_data 도구로 기록하라.
근거가 부족하면 해당 배열을 비워두거나 항목 수를 줄여라. 숫자(mass_audience_expansion, evidence_strength)는
모듈에서 실제로 뒷받침되는 정도를 0-100으로 추정하되, 근거가 전혀 없는 포지셔닝 후보는 만들지 마라.
character_architecture는 인물/그룹처럼 캐릭터·페르소나 분석이 데이터로 뒷받침될 때만 applicable=true로 하고,
브랜드/제품처럼 맞지 않으면 applicable=false, layers는 빈 배열로 둬라.
funnel은 각 단계(Discovery~Advocacy)에 대해 데이터에서 확인되는 trigger/dropoff만 채우고, 근거 없으면 null로 둬라.
perception_map은 이 IP 유형에 맞는 인식 축 3~6개를 고르고(예: 친근함↔동경), position은 데이터 근거로 판단되는
현재 위치를 0~100(0=left_label 쪽, 100=right_label 쪽)으로 추정하라. opportunity_map은 KEEP(이미 강한 가치)/
DISCOVER(발견됐지만 미활용)/CREATE(확장 가능한 새 포지션)로 분류하되 각 항목에 반드시 데이터 근거를 붙여라.

${params.modules.map((m) => `--- ${m.title} ---\n${m.content}`).join("\n\n")}`;

  const res = await anthropic().messages.create({
    model: "claude-sonnet-5",
    max_tokens: 3000,
    system: IP_INTELLIGENCE_SYSTEM_PROMPT,
    tools: [SCHEMA],
    tool_choice: { type: "tool", name: "record_visual_data" },
    messages: [{ role: "user", content: prompt }],
  });

  const toolUse = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  if (!toolUse) return EMPTY;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const input = toolUse.input as any;

  return {
    ipLabel: input.ip_label || "IP",
    diagnostic: {
      strongAssets: input.diagnostic?.strong_assets ?? [],
      hiddenAssets: input.diagnostic?.hidden_assets ?? [],
      weakSignals: input.diagnostic?.weak_signals ?? [],
      risks: input.diagnostic?.risks ?? [],
    },
    funnel: {
      stages: (input.funnel?.stages ?? []).map((s: Record<string, unknown>) => ({
        stage: s.stage,
        trigger: s.trigger ?? null,
        dropoff: s.dropoff ?? null,
        strength: s.strength ?? "unknown",
      })),
    },
    characterArchitecture: {
      applicable: Boolean(input.character_architecture?.applicable),
      layers: input.character_architecture?.layers ?? [],
    },
    opportunityMatrix: {
      points: (input.opportunity_matrix?.points ?? []).map((p: Record<string, unknown>) => ({
        label: p.label,
        massAudienceExpansion: Number(p.mass_audience_expansion ?? 0),
        evidenceStrength: Number(p.evidence_strength ?? 0),
        note: p.note,
      })),
    },
    perceptionMap: {
      axes: (input.perception_map?.axes ?? []).map((a: Record<string, unknown>) => ({
        leftLabel: a.left_label,
        rightLabel: a.right_label,
        position: Number(a.position ?? 50),
        note: a.note,
      })),
    },
    opportunityMap: {
      keep: input.opportunity_map?.keep ?? [],
      discover: input.opportunity_map?.discover ?? [],
      create: input.opportunity_map?.create ?? [],
    },
  } as VisualData;
}
