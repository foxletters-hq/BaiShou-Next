export type MemoryOrganizePipelineState = 'idle' | 'embed' | 'graph'

/** 只有抽图真正在跑，或嵌入还在跑、图谱还没开始时，才显示「整理关系图谱」等待态 */
export function shouldWaitForGraphExtract(input: {
  organizePipeline: MemoryOrganizePipelineState
  indexing: boolean
}): boolean {
  return (
    input.organizePipeline === 'graph' ||
    (input.organizePipeline === 'embed' && input.indexing)
  )
}
