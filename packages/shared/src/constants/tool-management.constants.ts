import type { ToolManagementConfig } from '../types/settings.types'

/** 旧 ID，读取配置时自动迁移 */
export const LEGACY_AUTO_INJECT_TIME_TOOL_ID = 'auto_inject_current_time'

/** 工具管理页中「自动注入当前时间」的虚拟工具 ID（非模型可调用工具） */
export const AUTO_INJECT_TIME_TOOL_ID = 'auto_inject_time'

/** @deprecated 使用 AUTO_INJECT_TIME_TOOL_ID */
export const AUTO_INJECT_CURRENT_TIME_TOOL_ID = AUTO_INJECT_TIME_TOOL_ID

/** 与 settings 默认值一致：默认关闭 auto inject time */
export const DEFAULT_TOOL_MANAGEMENT_CONFIG: ToolManagementConfig = {
  disabledToolIds: [AUTO_INJECT_TIME_TOOL_ID],
  customConfigs: {}
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

  return { ...config, disabledToolIds, customConfigs }
}

function isAutoInjectTimeDisabled(disabledToolIds: string[]): boolean {
  return (
    disabledToolIds.includes(AUTO_INJECT_TIME_TOOL_ID) ||
    disabledToolIds.includes(LEGACY_AUTO_INJECT_TIME_TOOL_ID)
  )
}

/**
 * 是否在 system prompt 中自动注入当前时间。
 * 空 disabledToolIds 视为开启（兼容旧配置）；显式列入 ID 则关闭。
 */
export function isAutoInjectCurrentTimeEnabled(disabledToolIds: string[] | undefined): boolean {
  if (!disabledToolIds || disabledToolIds.length === 0) {
    return true
  }
  return !isAutoInjectTimeDisabled(disabledToolIds)
}
