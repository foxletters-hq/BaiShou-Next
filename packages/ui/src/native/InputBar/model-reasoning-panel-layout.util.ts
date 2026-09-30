export interface ModelReasoningPanelRect {
  x: number
  y: number
  width: number
  height: number
}

export interface ModelReasoningPanelLayoutInput {
  trigger: ModelReasoningPanelRect
  host: ModelReasoningPanelRect
  gap?: number
  margin?: number
  preferredWidth?: number
  maxHeightCap?: number
  /** 触发器窗口坐标换算到 host 局部坐标时要补上的 Y（如 Android 状态栏） */
  triggerYOffset?: number
}

export interface ModelReasoningPanelLayout {
  bottom: number
  right: number
  width: number
  maxHeight: number
}

const DEFAULT_GAP = 4
const DEFAULT_MARGIN = 8
const DEFAULT_PREFERRED_WIDTH = 280
const DEFAULT_MAX_HEIGHT = 420
const MIN_PANEL_HEIGHT = 120

/**
 * 把模型选择面板贴在触发按钮上方。
 * trigger / host 必须尽量是同一套坐标；Android 上 Modal 常比 measureInWindow
 * 多出状态栏高度，用 triggerYOffset 补上，避免面板悬在按钮上方一截。
 */
export function computeModelReasoningPanelLayout(
  input: ModelReasoningPanelLayoutInput
): ModelReasoningPanelLayout {
  const gap = input.gap ?? DEFAULT_GAP
  const margin = input.margin ?? DEFAULT_MARGIN
  const preferredWidth = input.preferredWidth ?? DEFAULT_PREFERRED_WIDTH
  const maxHeightCap = input.maxHeightCap ?? DEFAULT_MAX_HEIGHT
  const triggerYOffset = input.triggerYOffset ?? 0
  const { trigger, host } = input

  const width = Math.min(preferredWidth, Math.max(margin * 2, host.width - margin * 2))
  const triggerTopInHost = trigger.y + triggerYOffset - host.y
  const triggerRightInHost = trigger.x + trigger.width - host.x

  const bottom = Math.max(margin, host.height - triggerTopInHost + gap)
  const rightAlign = host.width - triggerRightInHost
  const right = Math.max(margin, Math.min(rightAlign, host.width - width - margin))
  const spaceAbove = triggerTopInHost - gap - margin
  const maxHeight = Math.min(maxHeightCap, Math.max(MIN_PANEL_HEIGHT, spaceAbove))

  return { bottom, right, width, maxHeight }
}
