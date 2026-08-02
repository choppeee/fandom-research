import crypto from "crypto";

/** 연결 계정 access token은 (author-key와 달리) 나중에 실제 API 호출에 다시 써야 해서
 * 해시가 아니라 복호화 가능한 대칭암호화를 쓴다 - AES-256-GCM. 서버 전용 키가 없으면
 * 임시값으로 대체하지 않고 명시적으로 실패한다(AUTHOR_HASH_SECRET과 동일 원칙). */
function encryptionKey(): Buffer {
  const raw = process.env.SOCIAL_TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("SOCIAL_TOKEN_ENCRYPTION_KEY가 설정되지 않았습니다. 연결 계정 토큰을 암호화할 수 없습니다.");
  }
  const key = Buffer.from(raw, "hex");
  if (key.length !== 32) {
    throw new Error("SOCIAL_TOKEN_ENCRYPTION_KEY는 32바이트(64자리 hex)여야 합니다.");
  }
  return key;
}

export function encryptToken(plainToken: string): string {
  const key = encryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plainToken, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // iv:authTag:ciphertext, 전부 base64 - 로그에 절대 그대로 출력하지 않는다
  return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptToken(stored: string): string {
  const key = encryptionKey();
  const [ivB64, tagB64, dataB64] = stored.split(":");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("저장된 토큰 형식이 올바르지 않습니다.");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]);
  return decrypted.toString("utf8");
}
