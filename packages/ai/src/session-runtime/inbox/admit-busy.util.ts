/**
 * 忙时 admit 决策：有活跃 stream claim 时一律入队，禁止 forceStart 清 busy 后开新流打断当前回合。
 * forceStart 仅用于清掉「宿主标记仍 busy、但 claim 已空」的陈旧标记。
 */
export function resolveAdmitStartDecision(input: {
  forceStart?: boolean
  hostMarkedBusy: boolean
  streamClaimBusy: boolean
}): { action: 'queue' | 'start'; clearHostBusyMark: boolean } {
  if (input.streamClaimBusy) {
    return { action: 'queue', clearHostBusyMark: false }
  }
  if (input.hostMarkedBusy) {
    if (input.forceStart) {
      return { action: 'start', clearHostBusyMark: true }
    }
    return { action: 'queue', clearHostBusyMark: false }
  }
  return { action: 'start', clearHostBusyMark: false }
}
