export type MomentumBeginAction = 'ignore' | 'track' | 'exit_following'

/** 程序化平滑贴底会触发 RN 的 momentum begin，不能当成用户离开底部 */
export function resolveMomentumScrollBegin(params: {
  isSmoothScrolling: boolean
  hasMetrics: boolean
  nearContentBottom: boolean
}): MomentumBeginAction {
  if (params.isSmoothScrolling) return 'ignore'
  if (!params.hasMetrics) return 'track'
  if (!params.nearContentBottom) return 'exit_following'
  return 'track'
}

/** 程序化平滑贴底期间的 offset 抖动不能当成上滑离开 */
export function shouldTreatScrollAsUserLeave(params: {
  isSmoothScrolling: boolean
  deltaY: number
  isUserDragging: boolean
  nearBottom: boolean
}): boolean {
  if (params.isSmoothScrolling) return false
  return params.deltaY < -2 || (params.isUserDragging && !params.nearBottom)
}

/** 拖动手势一开始就会进入 idle，按钮必须等真正离开底部再出现，否则会闪一下 */
export function shouldShowScrollToBottomButton(params: {
  followMode: 'following' | 'idle'
  nearBottom: boolean
}): boolean {
  return params.followMode === 'idle' && !params.nearBottom
}
