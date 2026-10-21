import type { ToolManagementConfig } from '../types/settings.types'

/** 旧 ID，读取配置时自动迁移 */
export const LEGACY_AUTO_INJECT_TIME_TOOL_ID = 'auto_inject_current_time'

/** 工具管理页中「自动注入当前时间」的虚拟工具 ID（非模型可调用工具） */
export const AUTO_INJECT_TIME_TOOL_ID = 'auto_inject_time'

/** @deprecated 使用 AUTO_INJECT_TIME_TOOL_ID */
export const AUTO_INJECT_CURRENT_TIME_TOOL_ID = AUTO_INJECT_TIME_TOOL_ID

/** 与 settings 默认值一致：默认关闭 auto inject time，默认开启趣味状态文案 */
export const DEFAULT_TOOL_MANAGEMENT_CONFIG: ToolManagementConfig = {
  disabledToolIds: [AUTO_INJECT_TIME_TOOL_ID],
  customConfigs: {},
  playfulProcessStatus: true
}

type PlayfulProcessStatusListener = (enabled: boolean) => void

let sharedPlayfulProcessStatus = true
const playfulProcessStatusListeners = new Set<PlayfulProcessStatusListener>()

export function getSharedPlayfulProcessStatus(): boolean {
  return sharedPlayfulProcessStatus
}

export function publishPlayfulProcessStatus(enabled: boolean | undefined): void {
  const next = enabled !== false
  if (sharedPlayfulProcessStatus === next) return
  sharedPlayfulProcessStatus = next
  for (const listener of playfulProcessStatusListeners) {
    listener(next)
  }
}

export function subscribePlayfulProcessStatus(
  listener: PlayfulProcessStatusListener
): () => void {
  playfulProcessStatusListeners.add(listener)
  listener(sharedPlayfulProcessStatus)
  return () => {
    playfulProcessStatusListeners.delete(listener)
  }
}

export function normalizeToolManagementConfig(config: ToolManagementConfig): ToolManagementConfig {
  const disabledToolIds = Array.from(
    new Set(
      (config.disabledToolIds ?? []).map((id) =>
        id === LEGACY_AUTO_INJECT_TIME_TOOL_ID ? AUTO_INJECT_TIME_TOOL_ID : id
      )
    )
  )

  const customConfigs = { ...(config.customConfigs ?? {}) }
  const legacyCustom = customConfigs[LEGACY_AUTO_INJECT_TIME_TOOL_ID]
  if (legacyCustom) {
    customConfigs[AUTO_INJECT_TIME_TOOL_ID] = {
      ...(customConfigs[AUTO_INJECT_TIME_TOOL_ID] ?? {}),
      ...legacyCustom
    }
    delete customConfigs[LEGACY_AUTO_INJECT_TIME_TOOL_ID]
  }

  const playfulProcessStatus = config.playfulProcessStatus !== false
  publishPlayfulProcessStatus(playfulProcessStatus)

  return { ...config, disabledToolIds, customConfigs, playfulProcessStatus }
}

function isAutoInjectTimeDisabled(disabledToolIds: string[]): boolean {
  return (
    disabledToolIds.includes(AUTO_INJECT_TIME_TOOL_ID) ||
    disabledToolIds.includes(LEGACY_AUTO_INJECT_TIME_TOOL_ID)
  )
}

/**
 * 是否为消息加发送时刻壳，并在 system 的 runtime_context 写入稳定时区。
 * 默认关闭：空或未配置视为关闭；显式列入 ID 也关闭；列表里没有该 ID 则开启。
 */
export function isAutoInjectCurrentTimeEnabled(disabledToolIds: string[] | undefined): boolean {
  if (!disabledToolIds || disabledToolIds.length === 0) {
    return false
  }
  return !isAutoInjectTimeDisabled(disabledToolIds)
}

/** 正在把「当前时间」从关改为开（用于设置页确认提示） */
export function isEnablingAutoInjectTime(toolId: string, currentlyEnabled: boolean): boolean {
  return (
    (toolId === AUTO_INJECT_TIME_TOOL_ID || toolId === LEGACY_AUTO_INJECT_TIME_TOOL_ID) &&
    currentlyEnabled === false
  )
}
