export type KnowledgeRecoverStaleResult = {
  resetSources: number
  reclaimedEmbedJobs: number
  droppedExtractJobs: number
}

/** 恢复账本后不要把提取/嵌入拉起来；未完成的资料由用户在笔记本里点嵌入、重试或开始整理。 */
export function shouldKickKnowledgeIngestAfterRecover(
  _result: KnowledgeRecoverStaleResult
): boolean {
  return false
}
