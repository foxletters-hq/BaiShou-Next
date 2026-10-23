/**
 * 重发/编辑/重新生成会先截断并删掉失效快照。
 * 从未压过的会话不要借着重发开第一次压缩；只有前面还剩压缩快照时，才按阈值重新判定。
 */
export function shouldEvaluateCompressionAfterResend(input: {
  forceRecompress?: boolean
  hasCompressionSnapshot: boolean
}): boolean {
  if (input.forceRecompress !== true) return true
  return input.hasCompressionSnapshot
}

/** 重发且上一张快照还在：触发量只算快照之后的增量 */
export function shouldCountTokensSinceLastSnapshot(input: {
  forceRecompress?: boolean
  hasCompressionSnapshot: boolean
}): boolean {
  return input.forceRecompress === true && input.hasCompressionSnapshot
}
