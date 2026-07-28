/** 동시성을 제한하며 배열 항목을 비동기로 처리한다 (Vercel 함수 실행시간 절약용). */
export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const current = nextIndex++;
      if (current >= items.length) return;
      results[current] = await fn(items[current], current);
    }
  }

  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(Array.from({ length: workerCount }, worker));
  return results;
}
