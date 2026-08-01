/** PDF 리포트 디자인 시스템 토큰. 모든 페이지 템플릿/차트가 이 값만 사용한다.
 * 원칙: 색이 디자인을 만들지 않는다. 배경은 white/near-white, 퍼플은 accent로만 쓴다. */
export const COLORS = {
  primary: "#6F4CF6", // accent 전용 (CTA, 핵심 숫자, 차트 주 계열, 배지)
  primaryTint: "#F1EDFE",
  background: "#FAFAFC",
  surface: "#FFFFFF",
  panelTint: "#F7F6F9", // 순중립 패널 배경 (더 이상 보라색 틴트 아님)
  text: "#17151F",
  textMuted: "#686371",
  border: "#E7E4EC",
  positive: "#16A34A",
  positiveTint: "#EAF7EE",
  warning: "#D97706",
  warningTint: "#FDF3E4",
  risk: "#DC2626",
  riskTint: "#FBEAEA",
  neutralChart: "#ADA9B8",
} as const;

/** 순중립 그레이 스케일 (더 이상 라벤더 틴트 없음). */
export const GRAY = {
  50: "#FAFAFA",
  100: "#F2F1F5",
  200: "#E7E4EC",
  300: "#D3D0DA",
  400: "#ADA9B8",
  500: "#8A8594",
  600: "#686371",
  700: "#4A4650",
  800: "#2E2B33",
  900: "#17151F",
} as const;

/** IP별로 살짝 다른 accent를 순환 배정한다 (전체 톤은 유지, IP 구분만 되도록). */
const ACCENT_PALETTE = ["#0D9488", "#2563EB", "#DB2777", "#CA8A04", "#059669", "#6F4CF6"];
export function accentForKeyword(keyword: string): string {
  let hash = 0;
  for (let i = 0; i < keyword.length; i++) hash = (hash * 31 + keyword.charCodeAt(i)) >>> 0;
  return ACCENT_PALETTE[hash % ACCENT_PALETTE.length];
}

export const TYPE = {
  pageTitle: "28px",
  sectionNumber: "64px",
  headline: "22px",
  subhead: "15px",
  body: "13px",
  caption: "9.5px",
} as const;

export const PAGE = {
  width: 1280,
  height: 720,
  margin: 56,
} as const;

export const EVIDENCE_LABEL: Record<string, string> = {
  high: "HIGH",
  medium: "MEDIUM",
  low: "LOW",
  unknown: "UNKNOWN",
};

export function evidenceDots(level: string): string {
  const norm = level?.toLowerCase?.() ?? "";
  const filled = norm === "high" ? 5 : norm === "medium" ? 3 : norm === "low" ? 1 : 0;
  return "●".repeat(filled) + "○".repeat(5 - filled);
}

export function confidenceLabel(level: string): string {
  const norm = level?.toUpperCase?.() ?? "MEDIUM";
  return EVIDENCE_LABEL[norm.toLowerCase()] ?? norm;
}
