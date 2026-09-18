export type KnowledgeRecoverStaleResult = {
  resetSources: number
  reclaimedEmbedJobs: number
  droppedExtractJobs: number
}

/** 打开笔记本只恢复账本；没有欠账时不要把提取/嵌入再拉起来，避免主进程卡在 PDF/视觉抽取。 */
export function shouldKickKnowledgeIngestAfterRecover(
  result: KnowledgeRecoverStaleResult
): boolean {
  return result.resetSources > 0 || result.reclaimedEmbedJobs > 0 || result.droppedExtractJobs > 0
}
