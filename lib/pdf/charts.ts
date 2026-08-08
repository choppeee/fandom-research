import { COLORS, GRAY, TYPE_SCALE } from "./tokens";

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
      <text x="${labelWidth - 10}" y="${y + barHeight / 2 + 4}" text-anchor="end" font-size="${TYPE_SCALE.caption}" fill="${GRAY[700]}">${esc(item.label)}</text>
      <rect x="${labelWidth}" y="${y}" width="${w}" height="${barHeight}" rx="4" fill="${color}" />
      <text x="${labelWidth + w + 8}" y="${y + barHeight / 2 + 4}" font-size="${TYPE_SCALE.caption}" fill="${GRAY[600]}">${item.value}</text>
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
       <text x="16" y="${i * 22 + 9}" font-size="${TYPE_SCALE.caption}" fill="${GRAY[700]}">${esc(seg.label)} ${Math.round((seg.value / total) * 100)}%</text>`
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
      return `<text x="${labelWidth - 10}" y="${y + barHeight / 2 + 4}" text-anchor="end" font-size="${TYPE_SCALE.caption}" fill="${GRAY[700]}">${esc(row.label)}</text>${segs}`;
    })
    .join("");

  return `<svg width="${opts.width}" height="${height}" viewBox="0 0 ${opts.width} ${height}" xmlns="http://www.w3.org/2000/svg">${bars}</svg>`;
}

/** 양극 축 (Perception Map). */
export function bipolarAxisChart(
  axes: { leftLabel: string; rightLabel: string; position: number; note?: string }[],
  opts: { width: number; color?: string } = { width: 620 }
): string {
  if (axes.length === 0) return `<div class="chart-empty">표시할 데이터가 없습니다</div>`;
  const color = opts.color ?? COLORS.primary;
  const rowHeight = 54;
  const height = axes.length * rowHeight;
  const trackX = 130;
  const trackWidth = opts.width - trackX - 130;

  const rows = axes
    .map((axis, i) => {
      const y = i * rowHeight + 26;
      const px = trackX + (Math.max(0, Math.min(100, axis.position)) / 100) * trackWidth;
      return `
      <text x="${trackX - 10}" y="${y + 4}" text-anchor="end" font-size="${TYPE_SCALE.caption}" fill="${GRAY[700]}">${esc(axis.leftLabel)}</text>
      <line x1="${trackX}" y1="${y}" x2="${trackX + trackWidth}" y2="${y}" stroke="${GRAY[200]}" stroke-width="3" stroke-linecap="round"/>
      <circle cx="${px.toFixed(1)}" cy="${y}" r="7" fill="${color}" />
      <text x="${trackX + trackWidth + 10}" y="${y + 4}" font-size="${TYPE_SCALE.caption}" fill="${GRAY[700]}">${esc(axis.rightLabel)}</text>
    `;
    })
    .join("");

  return `<svg width="${opts.width}" height="${height}" viewBox="0 0 ${opts.width} ${height}" xmlns="http://www.w3.org/2000/svg">${rows}</svg>`;
}

/** 오디언스 퍼널. */
export function funnelChart(
  stages: { stage: string; trigger?: string | null; strength?: string }[],
  opts: { width: number; color?: string } = { width: 1080 }
): string {
  if (stages.length === 0) return `<div class="chart-empty">표시할 데이터가 없습니다</div>`;
  const n = stages.length;
  const gap = 14;
  const segW = (opts.width - gap * (n - 1)) / n;
  const height = 120;
  const accent = opts.color ?? COLORS.primary;

  const strengthColor = (s?: string) => (s === "high" ? accent : s === "medium" ? `${accent}80` : s === "low" ? GRAY[300] : GRAY[200]);

  const blocks = stages
    .map((s, i) => {
      const x = i * (segW + gap);
      const topInset = i * 6;
      return `
      <rect x="${x}" y="${topInset}" width="${segW}" height="${height - topInset}" rx="8" fill="${strengthColor(s.strength)}" />
      <text x="${x + segW / 2}" y="${topInset + 26}" text-anchor="middle" font-size="${TYPE_SCALE.body}" font-weight="700" fill="white">${esc(s.stage)}</text>
    `;
    })
    .join("");

  const arrows = stages
    .slice(0, -1)
    .map((_, i) => {
      const x = (i + 1) * (segW + gap) - gap / 2;
      return `<text x="${x}" y="${height / 2}" text-anchor="middle" font-size="${TYPE_SCALE.section}" fill="${GRAY[400]}">›</text>`;
    })
    .join("");

  return `<svg width="${opts.width}" height="${height}" viewBox="0 0 ${opts.width} ${height}" xmlns="http://www.w3.org/2000/svg">${blocks}${arrows}</svg>`;
}

/** 2x2 매트릭스 (산점도). 사분면 이름 + 번호가 붙은 버블. 라벨은 그래프 안에 직접 넣지 않고 번호만 표기 -
 * 실제 라벨 텍스트는 페이지 템플릿에서 번호별 사이드 리스트로 렌더링한다. */
export function matrix2x2(
  points: { x: number; y: number; color?: string }[],
  opts: {
    width: number;
    height: number;
    xLabel: string;
    yLabel: string;
    quadrants?: { topRight: string; topLeft: string; bottomRight: string; bottomLeft: string };
  }
): string {
  const { width, height, xLabel, yLabel, quadrants } = opts;
  const pad = 64;
  const plotW = width - pad * 2;
  const plotH = height - pad * 2;

  const dotPositions = points.map((p) => ({
    px: pad + (Math.max(0, Math.min(100, p.x)) / 100) * plotW,
    py: pad + plotH - (Math.max(0, Math.min(100, p.y)) / 100) * plotH,
  }));

  const dots = points
    .map((p, i) => {
      const { px, py } = dotPositions[i];
      const color = p.color ?? COLORS.primary;
      return `
      <circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="13" fill="${color}" fill-opacity="0.14" />
      <circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="9" fill="${color}" />
      <text x="${px.toFixed(1)}" y="${(py + 3.5).toFixed(1)}" text-anchor="middle" font-size="${TYPE_SCALE.caption}" font-weight="700" fill="white">${i + 1}</text>
    `;
    })
    .join("");

  const svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <rect x="${pad}" y="${pad}" width="${plotW}" height="${plotH}" fill="none" stroke="${GRAY[200]}" stroke-width="1.5" />
    <line x1="${pad + plotW / 2}" y1="${pad}" x2="${pad + plotW / 2}" y2="${pad + plotH}" stroke="${GRAY[100]}" stroke-width="1" stroke-dasharray="4 4" />
    <line x1="${pad}" y1="${pad + plotH / 2}" x2="${pad + plotW}" y2="${pad + plotH / 2}" stroke="${GRAY[100]}" stroke-width="1" stroke-dasharray="4 4" />
    <text x="${pad + plotW / 2}" y="${height - 16}" text-anchor="middle" font-size="${TYPE_SCALE.caption}" fill="${GRAY[600]}">${esc(xLabel)}</text>
    <text x="18" y="${pad + plotH / 2}" text-anchor="middle" font-size="${TYPE_SCALE.caption}" fill="${GRAY[600]}" transform="rotate(-90 18 ${pad + plotH / 2})">${esc(yLabel)}</text>
    ${dots}
  </svg>`;

  // 사분면 이름표를 차트 안(점과 같은 좌표 공간)에 직접 넣으면, 데이터 점이 이름표 자리와
  // 겹칠 때마다(예: 근거 강도·확장 잠재력이 둘 다 낮은 점이 "DEPRIORITIZE" 칸에 찍히는 경우)
  // 점과 글자가 서로 가리는 문제가 반복해서 생겼다 - 특히 영문 단어가 길면(DEPRIORITIZE 등)
  // 칸 하나의 폭보다 글자가 넓어져서 위치를 옮기는 것만으로는 완전히 피할 수 없었다.
  // 그래서 이름표는 차트 바깥에, 점과 절대 겹치지 않는 별도 범례 줄로 뺐다.
  const legend = quadrants
    ? `<div style="display:flex;justify-content:center;gap:14px;flex-wrap:wrap;margin-top:6px;">
      <span style="font-size:${TYPE_SCALE.caption};color:${GRAY[500]};"><strong style="color:${GRAY[600]};">↗</strong> ${esc(quadrants.topRight)}</span>
      <span style="font-size:${TYPE_SCALE.caption};color:${GRAY[500]};"><strong style="color:${GRAY[600]};">↖</strong> ${esc(quadrants.topLeft)}</span>
      <span style="font-size:${TYPE_SCALE.caption};color:${GRAY[500]};"><strong style="color:${GRAY[600]};">↘</strong> ${esc(quadrants.bottomRight)}</span>
      <span style="font-size:${TYPE_SCALE.caption};color:${GRAY[500]};"><strong style="color:${GRAY[600]};">↙</strong> ${esc(quadrants.bottomLeft)}</span>
    </div>`
    : "";

  return `<div>${svg}${legend}</div>`;
}

/** 리스크 매트릭스: X=발생 빈도/근거 강도, Y=심각도. matrix2x2를 리스크 전용 사분면 이름으로 감싼 것. */
export function riskMatrixChart(
  points: { severity: number; likelihood: number }[],
  opts: { width: number; height: number } = { width: 460, height: 340 }
): string {
  return matrix2x2(
    points.map((p) => ({ x: p.likelihood, y: p.severity, color: COLORS.risk })),
    {
      ...opts,
      xLabel: "근거 강도 / 반복성",
      yLabel: "심각도",
      quadrants: { topRight: "긴급 대응", topLeft: "주시 필요", bottomRight: "관리 가능", bottomLeft: "낮은 우선순위" },
    }
  );
}

/** 관계 네트워크 다이어그램 (중심 노드 + 관계 노드들, 노드 크기는 강도에 비례). */
export function relationshipNetwork(
  center: string,
  nodes: { label: string; strength: number }[],
  opts: { width: number; height: number; color?: string } = { width: 520, height: 320 }
): string {
  if (nodes.length === 0) return `<div class="chart-empty">표시할 데이터가 없습니다</div>`;
  const { width, height } = opts;
  const color = opts.color ?? COLORS.primary;
  const cx = width / 2;
  const cy = height / 2;
  const r = Math.min(width, height) / 2 - 70;

  const items = nodes.slice(0, 6).map((n, i) => {
    const angle = (i / nodes.length) * 2 * Math.PI - Math.PI / 2;
    const nx = cx + r * Math.cos(angle);
    const ny = cy + r * Math.sin(angle);
    const nodeR = 8 + Math.max(0, Math.min(100, n.strength)) * 0.16;
    return { nx, ny, nodeR, label: n.label };
  });

  const lines = items
    .map((n) => `<line x1="${cx}" y1="${cy}" x2="${n.nx.toFixed(1)}" y2="${n.ny.toFixed(1)}" stroke="${GRAY[200]}" stroke-width="2" />`)
    .join("");
  const nodeCircles = items
    .map(
      (n) => `
    <circle cx="${n.nx.toFixed(1)}" cy="${n.ny.toFixed(1)}" r="${n.nodeR.toFixed(1)}" fill="${color}" fill-opacity="0.85" />
    <text x="${n.nx.toFixed(1)}" y="${(n.ny + n.nodeR + 16).toFixed(1)}" text-anchor="middle" font-size="${TYPE_SCALE.caption}" fill="${GRAY[700]}">${esc(n.label)}</text>
  `
    )
    .join("");

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    ${lines}
    <circle cx="${cx}" cy="${cy}" r="30" fill="${color}" />
    <text x="${cx}" y="${cy + 4}" text-anchor="middle" font-size="${TYPE_SCALE.body}" font-weight="700" fill="white">${esc(center.slice(0, 6))}</text>
    ${nodeCircles}
  </svg>`;
}

/** 커버 페이지용: 실제 top keyword 데이터 기반 "키워드 성좌" 그래픽. 순수 장식이 아니라 데이터 파생 그래픽. */
export function keywordConstellation(
  keywords: { keyword: string; count: number }[],
  opts: { width: number; height: number; accent: string }
): string {
  const { width, height, accent } = opts;
  if (keywords.length === 0) {
    return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${width / 2}" cy="${height / 2}" r="${Math.min(width, height) / 3}" fill="${accent}14" />
    </svg>`;
  }
  const top = keywords.slice(0, 7);
  const max = Math.max(...top.map((k) => k.count), 1);
  const cx = width / 2;
  const cy = height / 2;
  const rBase = Math.min(width, height) / 2 - 40;

  const nodes = top.map((k, i) => {
    const angle = (i / top.length) * 2 * Math.PI - Math.PI / 2;
    const orbit = rBase * (0.45 + 0.55 * (1 - k.count / max === 0 ? 0.1 : (i % 3) * 0.18));
    const nx = cx + orbit * Math.cos(angle);
    const ny = cy + orbit * Math.sin(angle);
    const nodeR = 6 + (k.count / max) * 22;
    return { nx, ny, nodeR, label: k.keyword };
  });

  const lines = nodes
    .map((n, i) => {
      const next = nodes[(i + 1) % nodes.length];
      return `<line x1="${n.nx.toFixed(1)}" y1="${n.ny.toFixed(1)}" x2="${next.nx.toFixed(1)}" y2="${next.ny.toFixed(1)}" stroke="${accent}" stroke-opacity="0.18" stroke-width="1.5" />`;
    })
    .join("");
  const circles = nodes
    .map(
      (n, i) => `
    <circle cx="${n.nx.toFixed(1)}" cy="${n.ny.toFixed(1)}" r="${n.nodeR.toFixed(1)}" fill="${accent}" fill-opacity="${0.5 + (i === 0 ? 0.4 : 0)}" />
    <text x="${n.nx.toFixed(1)}" y="${(n.ny + n.nodeR + 15).toFixed(1)}" text-anchor="middle" font-size="${TYPE_SCALE.caption}" fill="${GRAY[600]}">${esc(n.label)}</text>
  `
    )
    .join("");

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    ${lines}
    ${circles}
  </svg>`;
}

/** 타임라인(언급량/참여량 추이). */
export function areaTimelineChart(
  points: { date: string; mentions: number; engagement: number }[],
  opts: { width: number; height?: number; color?: string } = { width: 900 }
): string {
  if (points.length === 0) return `<div class="chart-empty">표시할 데이터가 없습니다</div>`;
  const color = opts.color ?? COLORS.primary;
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

  // 라벨 하나("MM-DD")가 대략 32px을 차지하므로, 폭이 좁을 때 전부 그리면 겹친다.
  // 표시 가능한 개수만큼만 균등 간격으로 골라 그린다(마지막 포인트는 항상 포함).
  const labelWidth = 32;
  const maxLabels = Math.max(2, Math.floor(plotW / labelWidth));
  const labelStep = Math.max(1, Math.ceil(points.length / maxLabels));
  const labels = points
    .map((p, i) => {
      if (i % labelStep !== 0 && i !== points.length - 1) return "";
      const x = pad + i * stepX;
      return `<text x="${x.toFixed(1)}" y="${height - 8}" text-anchor="middle" font-size="${TYPE_SCALE.caption}" fill="${GRAY[500]}">${esc(p.date.slice(5))}</text>`;
    })
    .join("");

  return `<svg width="${opts.width}" height="${height}" viewBox="0 0 ${opts.width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <path d="${areaPath}" fill="${color}1A" />
    <path d="${mentionsPath}" fill="none" stroke="${color}" stroke-width="2.5" />
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
