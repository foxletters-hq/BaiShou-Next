/**
 * 工作区轮次回滚的磁盘→截断顺序：
 * cascadeRollback（磁盘）必须先于 truncateMessages；checkpoint 清理放在最后。
 * 抽出为纯异步步骤，便于单测，避免重 Electron 集成。
 */
export async function runCascadeThenTruncateSteps<TResult>(deps: {
  cascadeRollback: () => Promise<TResult>
  truncateMessages: () => Promise<void>
  removeCheckpoints: () => Promise<void>
}): Promise<TResult> {
  const result = await deps.cascadeRollback()
  await deps.truncateMessages()
  await deps.removeCheckpoints()
  return result
}
