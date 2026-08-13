import {
  BAISHOU_WORKSPACE_AGENT_GATE_CONFIG_KEY,
  DEFAULT_WORKSPACE_AGENT_GATE_CONFIG,
  applyWorkspaceSecurityModeToConfig,
  cloneBaishouAgentGateConfig,
  resolveWorkspaceSecurityMode,
  type BaishouAgentGateConfig
} from '@baishou/shared'
import { settingsManager } from '../ipc/settings.ipc'

function ensureExpanded(config: BaishouAgentGateConfig): BaishouAgentGateConfig {
  const mode = resolveWorkspaceSecurityMode(config)
  const withDefaults = cloneBaishouAgentGateConfig(config, DEFAULT_WORKSPACE_AGENT_GATE_CONFIG)
  // 始终按当前模式展开规则，保证三档语义一致
  return applyWorkspaceSecurityModeToConfig(withDefaults, mode)
}

/** 读取工作台全局门控（忽略旧 per-workspace 配置） */
export async function getGlobalWorkspaceGateConfig(): Promise<BaishouAgentGateConfig> {
  const saved = await settingsManager.get<BaishouAgentGateConfig>(
    BAISHOU_WORKSPACE_AGENT_GATE_CONFIG_KEY
  )
  return ensureExpanded(
    cloneBaishouAgentGateConfig(saved ?? null, DEFAULT_WORKSPACE_AGENT_GATE_CONFIG)
  )
}

/** 写入工作台全局门控 */
export async function setGlobalWorkspaceGateConfig(
  config: BaishouAgentGateConfig
): Promise<BaishouAgentGateConfig> {
  const explicit = config.securityMode
  const mode =
    explicit === 'full_access' || explicit === 'auto_review' || explicit === 'allow_list'
      ? explicit
      : resolveWorkspaceSecurityMode(config)
  const next = applyWorkspaceSecurityModeToConfig(
    cloneBaishouAgentGateConfig(
      {
        ...config,
        securityMode: mode,
        approvalPreset: undefined,
        scopePreset: undefined
      },
      DEFAULT_WORKSPACE_AGENT_GATE_CONFIG
    ),
    mode
  )
  // 落盘前去掉旧预设字段，避免下次回读误判
  const toStore: BaishouAgentGateConfig = {
    ...next,
    securityMode: mode
  }
  delete toStore.approvalPreset
  delete toStore.scopePreset
  await settingsManager.set(BAISHOU_WORKSPACE_AGENT_GATE_CONFIG_KEY, toStore)
  return toStore
}
