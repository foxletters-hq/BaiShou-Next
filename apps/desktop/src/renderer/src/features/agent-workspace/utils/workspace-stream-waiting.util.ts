export function streamTimelineHasRunningTool(
  timeline: ReadonlyArray<{ kind: string; status?: string }>,
  activeToolName?: string | null
): boolean {
  if (activeToolName) return true
  return timeline.some((item) => item.kind === 'tool' && item.status === 'running')
}

/** 工具行已有转动指示时，不再叠底部等待点 */
export function shouldShowStreamWaitingDots(input: {
  isStreaming: boolean
  isBridgeActive?: boolean
  streamError?: string | null
  lastItemIsLiveText: boolean
  hasRunningTool: boolean
}): boolean {
  return (
    input.isStreaming &&
    !input.isBridgeActive &&
    !input.streamError &&
    !input.lastItemIsLiveText &&
    !input.hasRunningTool
  )
}
