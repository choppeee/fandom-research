import QRCode from "qrcode";

/** 실패해도 리포트 전체를 막지 않도록 null을 반환한다 - 호출부는 QR 없이 링크 텍스트만 보여준다. */
export async function qrDataUri(text: string): Promise<string | null> {
  try {
    return await QRCode.toDataURL(text, { margin: 1, width: 180, color: { dark: "#111111", light: "#ffffff" } });
  } catch {
    return null;
  }
}
