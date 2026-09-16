/**
 * diary_embed_jobs 已整表退休。保留空实现以免旧入口编译失败。
 */
export async function consumeDiaryEmbedJobs(_options?: {
  limit?: number
  reason?: string
}): Promise<{ processed: number; failed: number; skipped?: string }> {
  return { processed: 0, failed: 0, skipped: 'retired' }
}

export async function getDiaryEmbedJobsPendingCount(): Promise<number> {
  return 0
}

export function scheduleConsumeDiaryEmbedJobs(_reason: string): void {
  // no-op
}
