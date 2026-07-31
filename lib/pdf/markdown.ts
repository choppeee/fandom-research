/** 아주 가벼운 마크다운 -> HTML 블록 변환기 + 단어수 기준 페이지 분할기. */

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inline(s: string): string {
  return escapeHtml(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
}

export type MdBlock = { html: string; words: number };

/** 모듈 본문 첫 줄이 "## 제목" 형태로 페이지 헤드라인과 중복되면 제거한다. */
export function stripLeadingHeading(markdown: string): string {
  const lines = markdown.split("\n");
  let i = 0;
  while (i < lines.length && !lines[i].trim()) i++;
  if (i < lines.length && /^#{1,3}\s+/.test(lines[i].trim())) {
    return lines.slice(i + 1).join("\n");
  }
  return markdown;
}

/** 마크다운 텍스트를 문단/헤딩/리스트 단위의 HTML 블록 배열로 변환한다. */
export function markdownToBlocks(markdown: string): MdBlock[] {
  const lines = markdown.split("\n");
  const blocks: MdBlock[] = [];
  let listBuffer: string[] = [];

  const flushList = () => {
    if (listBuffer.length === 0) return;
    const html = `<ul>${listBuffer.map((li) => `<li>${inline(li)}</li>`).join("")}</ul>`;
    blocks.push({ html, words: listBuffer.join(" ").split(/\s+/).length });
    listBuffer = [];
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushList();
      continue;
    }
    if (/^(-{3,}|\*{3,})$/.test(line)) {
      flushList();
      blocks.push({ html: `<hr style="border:none;border-top:1px solid #E7E1F5;margin:8px 0;" />`, words: 0 });
      continue;
    }
    if (/^#{1,3}\s+/.test(line)) {
      flushList();
      const level = line.match(/^#+/)?.[0].length ?? 2;
      const text = line.replace(/^#{1,3}\s+/, "");
      const tag = level <= 1 ? "h2" : level === 2 ? "h3" : "h4";
      blocks.push({ html: `<${tag}>${inline(text)}</${tag}>`, words: text.split(/\s+/).length });
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      listBuffer.push(line.replace(/^[-*]\s+/, ""));
      continue;
    }
    flushList();
    const quoteMatch = line.match(/^["“](.+?)["”]\s*\(좋아요\s*([\d,]+)\)/);
    if (quoteMatch) {
      blocks.push({
        html: `<div class="quote-card"><span>&ldquo;${inline(quoteMatch[1])}&rdquo;</span><div class="quote-source">— YouTube Comment · 좋아요 ${quoteMatch[2]}</div></div>`,
        words: quoteMatch[1].split(/\s+/).length + 4,
      });
      continue;
    }
    blocks.push({ html: `<p>${inline(line)}</p>`, words: line.split(/\s+/).length });
  }
  flushList();
  return blocks;
}

/** 블록들을 단어수 예산 안에서 여러 "페이지"로 나눈다. */
export function paginateBlocks(blocks: MdBlock[], wordsPerPage = 300): string[][] {
  const pages: string[][] = [];
  let current: string[] = [];
  let count = 0;
  for (const block of blocks) {
    if (count > 0 && count + block.words > wordsPerPage) {
      pages.push(current);
      current = [];
      count = 0;
    }
    current.push(block.html);
    count += block.words;
  }
  if (current.length > 0) pages.push(current);
  return pages.length > 0 ? pages : [[]];
}
