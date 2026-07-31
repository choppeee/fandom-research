/** PDF 리포트 디자인 시스템 토큰. 모든 페이지 템플릿/차트가 이 값만 사용한다. */
export const COLORS = {
  primary: "#7C3AED", // 서비스 브랜드 컬러(보라)와 동일
  primaryTint: "#F3EEFF",
  primarySoft: "#EDE4FF",
  background: "#FFFFFF",
  panelTint: "#F6F2FF",
  text: "#1E1B2E",
  textMuted: "#6B6478",
  border: "#E7E1F5",
  positive: "#16A34A",
  positiveTint: "#EAF7EE",
  warning: "#D97706",
  warningTint: "#FDF3E4",
  risk: "#DC2626",
  riskTint: "#FBEAEA",
  neutralChart: "#A79DC2",
} as const;

export const GRAY = {
  50: "#F8F7FB",
  100: "#F0EDF7",
  200: "#E1DCF0",
  300: "#C7BFE0",
  400: "#A79DC2",
  500: "#8A7FA3",
  600: "#6B6478",
  700: "#4C4759",
  800: "#312D3C",
  900: "#1E1B2E",
} as const;

/** IP별로 살짝 다른 accent를 순환 배정한다 (전체 톤은 유지, IP 구분만 되도록). */
const ACCENT_PALETTE = ["#0D9488", "#2563EB", "#DB2777", "#CA8A04", "#059669", "#7C3AED"];
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
  body: "12.5px",
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
  const filled = level === "high" ? 5 : level === "medium" ? 3 : level === "low" ? 1 : 0;
  return "●".repeat(filled) + "○".repeat(5 - filled);
}
