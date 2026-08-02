import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/server";
import { suggestMapping } from "@/lib/import/schema";

const MAX_FILE_BYTES = 4 * 1024 * 1024; // 4MB - Vercel 서버리스 요청 본문 한도 안쪽으로 여유있게
const MAX_ROWS = 500; // classify_batch가 행마다 LLM 호출을 하므로 비용/시간 상 상한을 둔다
const ALLOWED_EXTENSIONS = ["csv", "txt", "xlsx", "xls", "json"];

function extensionOf(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() ?? "";
}

function parseCsvLike(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const result = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
  const headers = result.meta.fields ?? [];
  return { headers, rows: result.data };
}

function parseXlsx(buffer: Buffer): { headers: string[]; rows: Record<string, string>[] } {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "" });
  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
  return { headers, rows };
}

function parseJson(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const data = JSON.parse(text);
  const arr = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : null;
  if (!arr) throw new Error("JSON은 객체 배열(array of objects) 형식이어야 합니다.");
  const headers = arr.length > 0 ? Object.keys(arr[0]) : [];
  return { headers, rows: arr };
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "업로드할 파일을 선택해주세요." }, { status: 400 });
  }

  const ext = extensionOf(file.name);
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return NextResponse.json(
      { error: `지원하지 않는 파일 형식입니다(.${ext}). CSV, XLSX, JSON, TXT만 지원합니다.` },
      { status: 400 }
    );
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: `파일이 너무 큽니다(${(file.size / 1024 / 1024).toFixed(1)}MB). 최대 ${MAX_FILE_BYTES / 1024 / 1024}MB까지 업로드할 수 있습니다.` },
      { status: 400 }
    );
  }

  const warnings: string[] = [];
  let headers: string[];
  let rows: Record<string, string>[];
  try {
    if (ext === "xlsx" || ext === "xls") {
      const buffer = Buffer.from(await file.arrayBuffer());
      ({ headers, rows } = parseXlsx(buffer));
    } else {
      const buffer = Buffer.from(await file.arrayBuffer());
      const text = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
      // utf-8이 아닌 인코딩(예: EUC-KR)으로 저장된 파일은 치환 문자(U+FFFD)가 다수 섞여 나온다 -
      // 자동 재인코딩은 하지 않고(잘못 추정하면 더 위험) 사용자에게 명확히 경고만 한다.
      const replacementCount = (text.match(/�/g) ?? []).length;
      if (replacementCount > 5) {
        warnings.push("파일 인코딩이 UTF-8이 아닌 것 같습니다(깨진 문자 감지). UTF-8로 다시 저장한 뒤 업로드해주세요.");
      }
      if (ext === "json") {
        ({ headers, rows } = parseJson(text));
      } else {
        ({ headers, rows } = parseCsvLike(text));
      }
    }
  } catch (err) {
    return NextResponse.json({ error: `파일을 읽지 못했습니다: ${err instanceof Error ? err.message : String(err)}` }, { status: 400 });
  }

  if (headers.length === 0 || rows.length === 0) {
    return NextResponse.json({ error: "파일에서 데이터를 찾지 못했습니다. 헤더 행이 있는지 확인해주세요." }, { status: 400 });
  }

  const totalRowCount = rows.length;
  if (rows.length > MAX_ROWS) {
    warnings.push(`행이 ${totalRowCount}건으로 상한(${MAX_ROWS}건)을 초과해 앞쪽 ${MAX_ROWS}건만 분석 대상으로 사용됩니다.`);
    rows = rows.slice(0, MAX_ROWS);
  }

  // 완전히 동일한 행(모든 컬럼 값 동일) 중복 카운트만 미리 알려준다 - 실제 제거는 commit 단계에서.
  const seen = new Set<string>();
  let duplicateCount = 0;
  for (const r of rows) {
    const key = JSON.stringify(r);
    if (seen.has(key)) duplicateCount++;
    else seen.add(key);
  }
  if (duplicateCount > 0) warnings.push(`완전히 동일한 행이 ${duplicateCount}건 발견되었습니다. 업로드 확정 시 자동으로 제거됩니다.`);

  return NextResponse.json({
    headers,
    rows, // 클라이언트가 매핑 조정 후 그대로 commit에 되돌려보낸다 - 서버는 파일을 별도 저장하지 않는다
    preview: rows.slice(0, 20),
    totalRowCount,
    usedRowCount: rows.length,
    suggestedMapping: suggestMapping(headers),
    warnings,
  });
}
