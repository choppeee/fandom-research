import { COLORS, GRAY } from "./tokens";

function esc(s: string): string {
  const plain = String(s).replace(/\*/g, "");
  return plain.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** 가로 랭킹 바 차트 (연관 키워드, 특성 빈도 등). */
export function barChartHorizontal(
  items: { label: string; value: number }[],
  opts: { width: number; barHeight?: number; gap?: number; color?: string } = { width: 560 }
): string {
  if (items.length === 0) return `<div class="chart-empty">표시할 데이터가 없습니다</div>`;
  const barHeight = opts.barHeight ?? 22;
  const gap = opts.gap ?? 10;
  const color = opts.color ?? COLORS.primary;
  const labelWidth = 130;
  const chartWidth = opts.width - labelWidth - 50;
  const max = Math.max(...items.map((i) => i.value), 1);
  const rowHeight = barHeight + gap;
  const height = items.length * rowHeight;

  const bars = items
    .map((item, i) => {
      const y = i * rowHeight;
      const w = Math.max(4, (item.value / max) * chartWidth);
      return `
      <text x="${labelWidth - 10}" y="${y + barHeight / 2 + 4}" text-anchor="end" font-size="11" fill="${GRAY[700]}">${esc(item.label)}</text>
      <rect x="${labelWidth}" y="${y}" width="${w}" height="${barHeight}" rx="4" fill="${color}" />
      <text x="${labelWidth + w + 8}" y="${y + barHeight / 2 + 4}" font-size="11" fill="${GRAY[600]}">${item.value}</text>
    `;
    })
    .join("");

  return `<svg width="${opts.width}" height="${height}" viewBox="0 0 ${opts.width} ${height}" xmlns="http://www.w3.org/2000/svg">${bars}</svg>`;
}

/** 도넛 차트 (감성 분포 등). */
export function donutChart(
  segments: { label: string; value: number; color: string }[],
  opts: { size?: number } = {}
): string {
  const size = opts.size ?? 200;
  const r = size / 2 - 14;
  const cx = size / 2;
  const cy = size / 2;
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  let angle = -90;
  const arcs = segments
    .filter((s) => s.value > 0)
    .map((seg) => {
      const frac = seg.value / total;
      const start = angle;
      const end = angle + frac * 360;
      angle = end;
      const large = end - start > 180 ? 1 : 0;
      const x1 = cx + r * Math.cos((Math.PI * start) / 180);
      const y1 = cy + r * Math.sin((Math.PI * start) / 180);
      const x2 = cx + r * Math.cos((Math.PI * end) / 180);
      const y2 = cy + r * Math.sin((Math.PI * end) / 180);
      return `<path d="M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z" fill="${seg.color}" />`;
    })
    .join("");

  const legend = segments
    .map(
      (seg, i) =>
        `<rect x="0" y="${i * 22}" width="10" height="10" rx="2" fill="${seg.color}" />
       <text x="16" y="${i * 22 + 9}" font-size="12" fill="${GRAY[700]}">${esc(seg.label)} ${Math.round((seg.value / total) * 100)}%</text>`
    )
    .join("");

  return `<svg width="${size + 140}" height="${size}" viewBox="0 0 ${size + 140} ${size}" xmlns="http://www.w3.org/2000/svg">
    ${arcs}
    <circle cx="${cx}" cy="${cy}" r="${r * 0.55}" fill="white" />
    <g transform="translate(${size + 16}, ${size / 2 - (segments.length * 22) / 2})">${legend}</g>
  </svg>`;
}

/** 스택 바 차트 (날짜별 감성 추이, 오디언스 세그먼트 등). */
export function stackedBarChart(
  rows: { label: string; segments: { value: number; color: string }[] }[],
  opts: { width: number; barHeight?: number; gap?: number } = { width: 560 }
): string {
  if (rows.length === 0) return `<div class="chart-empty">표시할 데이터가 없습니다</div>`;
  const barHeight = opts.barHeight ?? 20;
  const gap = opts.gap ?? 12;
  const labelWidth = 90;
  const chartWidth = opts.width - labelWidth - 10;
  const rowHeight = barHeight + gap;
  const height = rows.length * rowHeight;

  const bars = rows
    .map((row, i) => {
      const total = row.segments.reduce((s, x) => s + x.value, 0) || 1;
      const y = i * rowHeight;
      let x = labelWidth;
      const segs = row.segments
        .map((seg) => {
          const w = (seg.value / total) * chartWidth;
          const rect = `<rect x="${x.toFixed(1)}" y="${y}" width="${w.toFixed(1)}" height="${barHeight}" fill="${seg.color}" />`;
          x += w;
          return rect;
        })
        .join("");
      return `<text x="${labelWidth - 10}" y="${y + barHeight / 2 + 4}" text-anchor="end" font-size="11" fill="${GRAY[700]}">${esc(row.label)}</text>${segs}`;
    })
    .join("");

  return `<svg width="${opts.width}" height="${height}" viewBox="0 0 ${opts.width} ${height}" xmlns="http://www.w3.org/2000/svg">${bars}</svg>`;
}

/** 양극 축 (Perception Map). */
export function bipolarAxisChart(
  axes: { leftLabel: string; rightLabel: string; position: number; note?: string }[],
  opts: { width: number } = { width: 620 }
): string {
  if (axes.length === 0) return `<div class="chart-empty">표시할 데이터가 없습니다</div>`;
  const rowHeight = 54;
  const height = axes.length * rowHeight;
  const trackX = 130;
  const trackWidth = opts.width - trackX - 130;

  const rows = axes
    .map((axis, i) => {
      const y = i * rowHeight + 26;
      const px = trackX + (Math.max(0, Math.min(100, axis.position)) / 100) * trackWidth;
      return `
      <text x="${trackX - 10}" y="${y + 4}" text-anchor="end" font-size="11" fill="${GRAY[700]}">${esc(axis.leftLabel)}</text>
      <line x1="${trackX}" y1="${y}" x2="${trackX + trackWidth}" y2="${y}" stroke="${GRAY[200]}" stroke-width="3" stroke-linecap="round"/>
      <circle cx="${px.toFixed(1)}" cy="${y}" r="7" fill="${COLORS.primary}" />
      <text x="${trackX + trackWidth + 10}" y="${y + 4}" font-size="11" fill="${GRAY[700]}">${esc(axis.rightLabel)}</text>
    `;
    })
    .join("");

  return `<svg width="${opts.width}" height="${height}" viewBox="0 0 ${opts.width} ${height}" xmlns="http://www.w3.org/2000/svg">${rows}</svg>`;
}

/** 오디언스 퍼널. */
export function funnelChart(
  stages: { stage: string; trigger?: string | null; strength?: string }[],
  opts: { width: number } = { width: 1080 }
): string {
  if (stages.length === 0) return `<div class="chart-empty">표시할 데이터가 없습니다</div>`;
  const n = stages.length;
  const gap = 14;
  const segW = (opts.width - gap * (n - 1)) / n;
  const height = 120;

  const strengthColor = (s?: string) =>
    s === "high" ? COLORS.primary : s === "medium" ? "#B39DDB" : s === "low" ? GRAY[300] : GRAY[200];

  const blocks = stages
    .map((s, i) => {
      const x = i * (segW + gap);
      const topInset = i * 6;
      return `
      <rect x="${x}" y="${topInset}" width="${segW}" height="${height - topInset}" rx="8" fill="${strengthColor(s.strength)}" />
      <text x="${x + segW / 2}" y="${topInset + 26}" text-anchor="middle" font-size="13" font-weight="700" fill="white">${esc(s.stage)}</text>
    `;
    })
    .join("");

  const arrows = stages
    .slice(0, -1)
    .map((_, i) => {
      const x = (i + 1) * (segW + gap) - gap / 2;
      return `<text x="${x}" y="${height / 2}" text-anchor="middle" font-size="16" fill="${GRAY[400]}">›</text>`;
    })
    .join("");

  return `<svg width="${opts.width}" height="${height}" viewBox="0 0 ${opts.width} ${height}" xmlns="http://www.w3.org/2000/svg">${blocks}${arrows}</svg>`;
}

/** 2x2 오퍼튜니티 매트릭스 (산점도). */
export function matrix2x2(
  points: { label: string; x: number; y: number }[],
  opts: { width: number; height: number; xLabel: string; yLabel: string }
): string {
  const { width, height, xLabel, yLabel } = opts;
  const pad = 60;
  const plotW = width - pad * 2;
  const plotH = height - pad * 2;

  const dots = points
    .map((p) => {
      const px = pad + (Math.max(0, Math.min(100, p.x)) / 100) * plotW;
      const py = pad + plotH - (Math.max(0, Math.min(100, p.y)) / 100) * plotH;
      return `
      <circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="7" fill="${COLORS.primary}" fill-opacity="0.85" />
      <text x="${px.toFixed(1)}" y="${(py - 12).toFixed(1)}" text-anchor="middle" font-size="10.5" fill="${GRAY[700]}">${esc(p.label)}</text>
    `;
    })
    .join("");

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <rect x="${pad}" y="${pad}" width="${plotW}" height="${plotH}" fill="none" stroke="${GRAY[200]}" stroke-width="1.5" />
    <line x1="${pad + plotW / 2}" y1="${pad}" x2="${pad + plotW / 2}" y2="${pad + plotH}" stroke="${GRAY[100]}" stroke-width="1" stroke-dasharray="4 4" />
    <line x1="${pad}" y1="${pad + plotH / 2}" x2="${pad + plotW}" y2="${pad + plotH / 2}" stroke="${GRAY[100]}" stroke-width="1" stroke-dasharray="4 4" />
    <text x="${pad + plotW / 2}" y="${height - 16}" text-anchor="middle" font-size="12" fill="${GRAY[600]}">${esc(xLabel)}</text>
    <text x="18" y="${pad + plotH / 2}" text-anchor="middle" font-size="12" fill="${GRAY[600]}" transform="rotate(-90 18 ${pad + plotH / 2})">${esc(yLabel)}</text>
    ${dots}
  </svg>`;
}

/** 타임라인(언급량/참여량 추이). */
export function areaTimelineChart(
  points: { date: string; mentions: number; engagement: number }[],
  opts: { width: number; height?: number } = { width: 900 }
): string {
  if (points.length === 0) return `<div class="chart-empty">표시할 데이터가 없습니다</div>`;
  const height = opts.height ?? 220;
  const pad = 40;
  const plotW = opts.width - pad * 2;
  const plotH = height - pad * 1.6;
  const maxMentions = Math.max(...points.map((p) => p.mentions), 1);
  const stepX = points.length > 1 ? plotW / (points.length - 1) : 0;

  const pathFor = (key: "mentions" | "engagement", max: number) =>
    points
      .map((p, i) => {
        const x = pad + i * stepX;
        const y = pad + plotH - (p[key] / max) * plotH;
        return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");

  const maxEngagement = Math.max(...points.map((p) => p.engagement), 1);
  const mentionsPath = pathFor("mentions", maxMentions);
  const engagementPath = pathFor("engagement", maxEngagement);
  const areaPath = `${mentionsPath} L ${pad + plotW} ${pad + plotH} L ${pad} ${pad + plotH} Z`;

  const labels = points
    .map((p, i) => {
      const x = pad + i * stepX;
      return `<text x="${x.toFixed(1)}" y="${height - 8}" text-anchor="middle" font-size="9.5" fill="${GRAY[500]}">${esc(p.date.slice(5))}</text>`;
    })
    .join("");

  return `<svg width="${opts.width}" height="${height}" viewBox="0 0 ${opts.width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <path d="${areaPath}" fill="${COLORS.primaryTint}" />
    <path d="${mentionsPath}" fill="none" stroke="${COLORS.primary}" stroke-width="2.5" />
    <path d="${engagementPath}" fill="none" stroke="${GRAY[400]}" stroke-width="2" stroke-dasharray="4 3" />
    ${labels}
  </svg>`;
}

/** Evidence Strength를 점 5개짜리 confidence meter로 표현. */
export function confidenceMeter(level: string): string {
  const filled = level === "high" ? 5 : level === "medium" ? 3 : level === "low" ? 1 : 0;
  const dots = Array.from({ length: 5 }, (_, i) =>
    i < filled
      ? `<circle cx="${i * 14 + 6}" cy="6" r="5" fill="${COLORS.primary}" />`
      : `<circle cx="${i * 14 + 6}" cy="6" r="5" fill="${GRAY[200]}" />`
  ).join("");
  return `<svg width="76" height="12" viewBox="0 0 76 12" xmlns="http://www.w3.org/2000/svg">${dots}</svg>`;
}
