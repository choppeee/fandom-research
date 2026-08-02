/** PDF 리포트 디자인 시스템 토큰. 모든 페이지 템플릿/차트가 이 값만 사용한다.
 * Black & Red Intelligence Design System - 웹(app/globals.css)과 같은 팔레트를 쓴다.
 * 원칙: 배경은 warm off-white, Red는 CTA/핵심 강조/위험에만 절제해서 쓴다. */
export const COLORS = {
  primary: "#E3262E", // accent 전용 (CTA, 핵심 숫자, 차트 주 계열, 배지) - brand Red
  primaryTint: "#FBEAEC",
  background: "#F7F7F5",
  surface: "#FFFFFF",
  panelTint: "#F1F1EE",
  text: "#111111",
  textMuted: "#5E5E5E",
  border: "#E3E3E0",
  positive: "#16A34A",
  positiveTint: "#EAF7EE",
  warning: "#D97706",
  warningTint: "#FDF3E4",
  risk: "#E3262E",
  riskTint: "#FBEAEC",
  neutralChart: "#8B8B8B",
} as const;

/** 순중립 그레이 스케일. */
export const GRAY = {
  50: "#FAFAFA",
  100: "#F1F1EE",
  200: "#E3E3E0",
  300: "#D3D0CA",
  400: "#B8B8B3",
  500: "#8B8B8B",
  600: "#5E5E5E",
  700: "#4A4A4A",
  800: "#2E2E2E",
  900: "#111111",
} as const;

/** 키워드별로 accent를 살짝 다르게 배정하되, Black & Red 시스템 안에서만 순환한다(브랜드 Red +
 * 근접한 딥레드/블랙 톤) - 이전처럼 청록/파랑/핑크 등 시스템 밖 색을 쓰지 않는다. */
const ACCENT_PALETTE = ["#E3262E", "#A9151C", "#111111"];
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

// A4 세로, 96dpi 기준(210mm x 297mm ≈ 794 x 1123px). height는 "최소 높이"로만 쓰인다 -
// 본문이 길면 그 .page 블록만 자연스럽게 다음 물리 페이지로 흘러넘치고(overflow), 다음
// .page는 항상 새 페이지에서 시작한다(page-break-after:always). 고정 캔버스에 억지로
// 맞추던 이전 방식과 달리 텍스트가 잘리지 않는다.
export const PAGE = {
  width: 794,
  height: 1123,
  margin: 76, // 약 20mm
} as const;

export const EVIDENCE_LABEL: Record<string, string> = {
  high: "확신 높음",
  medium: "확신 보통",
  low: "확신 낮음",
  unknown: "확인 중",
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
