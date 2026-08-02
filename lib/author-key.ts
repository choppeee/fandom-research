import crypto from "crypto";

/** YouTube authorChannelId를 "이 job 범위 안에서만 유효한" 익명 식별자로 바꾼다.
 *
 * 원본 채널 ID는 이 함수 호출 한 번의 스코프 안에서만 존재하고, 반환되는 hex 문자열만
 * 호출자에게 넘어간다 - 호출자는 원본 authorChannelId를 저장/로그에 남기면 안 된다
 * (lib/collectors/youtube.ts의 getVideoComments가 이 규칙을 지킨다).
 *
 * jobId를 HMAC 입력에 섞기 때문에:
 * - 같은 job 안에서는 같은 작성자가 항상 같은 키를 가진다(작업 내부 중복 판별 가능).
 * - 다른 job에서는 같은 작성자라도 완전히 다른 키가 나온다(작업을 가로지른 추적 불가).
 * 일반 SHA-256 단독이 아니라 HMAC을 쓰는 이유는, 채널 ID 자체는 YouTube에 공개된 값이라
 * 단순 해시는 무차별 대입으로 원복 가능하기 때문 - 서버만 아는 secret이 없으면 안전하지 않다. */
export function computeAuthorKey(jobId: string, authorChannelId: string): string {
  const secret = process.env.AUTHOR_HASH_SECRET;
  if (!secret) {
    throw new Error(
      "AUTHOR_HASH_SECRET이 설정되지 않았습니다. 작성자 익명화 키 없이는 댓글을 저장할 수 없습니다(임시 기본값으로 대체하지 않음)."
    );
  }
  return crypto.createHmac("sha256", secret).update(`${jobId}:${authorChannelId}`).digest("hex");
}
