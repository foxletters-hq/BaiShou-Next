import {
  BAISHOU_AGENT_GATE_CONFIG_KEY,
  foldCompanionAllowlistIntoCapabilities,
  type BaishouAgentGateConfig
} from '@baishou/shared'
import {
  bridgeAgentGateEventBus,
  cloneBaishouAgentGateConfig,
  createBaishouAgentGate,
  type IBaishouAgentGate
} from '@baishou/ai'
import { DEFAULT_BAISHOU_AGENT_GATE_CONFIG } from '@baishou/database'
import { ensureMobileAgentGateInboxBridge } from '../../services/mobile-agent-gate.service'

type GateSettingsManager = {
  get: <T>(key: string) => Promise<T | null | undefined>
  set: (key: string, value: unknown) => Promise<unknown>
}

export function createMobileAgentGateRuntime(settingsManager: GateSettingsManager): {
  getAgentGate: () => IBaishouAgentGate
  reloadAgentGateConfig: () => Promise<void>
  persistBaishouAgentGateConfig: (config: BaishouAgentGateConfig) => Promise<void>
} {
  const agentGateConfig = cloneBaishouAgentGateConfig(DEFAULT_BAISHOU_AGENT_GATE_CONFIG)

  const persistBaishouAgentGateConfig = async (config: BaishouAgentGateConfig) => {
    const folded = foldCompanionAllowlistIntoCapabilities(config)
    Object.assign(agentGateConfig, {
      exclusionList: [...(folded.exclusionList ?? [])],
      allowlist: [...(folded.allowlist ?? [])],
      actionRules: folded.actionRules ? { ...folded.actionRules } : undefined,
      permissionRules: folded.permissionRules?.map((rule) => ({ ...rule })),
      repeatAssertAskThreshold: folded.repeatAssertAskThreshold,
      hideDeniedTools: folded.hideDeniedTools
    })
    await settingsManager.set(BAISHOU_AGENT_GATE_CONFIG_KEY, agentGateConfig)
  }

  const reloadAgentGateConfig = async () => {
    const saved = await settingsManager.get<BaishouAgentGateConfig>(BAISHOU_AGENT_GATE_CONFIG_KEY)
    const next = foldCompanionAllowlistIntoCapabilities(
      cloneBaishouAgentGateConfig(saved ?? DEFAULT_BAISHOU_AGENT_GATE_CONFIG)
    )
    Object.assign(agentGateConfig, next)
    if ((saved?.allowlist?.length ?? 0) !== next.allowlist.length) {
      await persistBaishouAgentGateConfig(agentGateConfig)
    }
  }

  const { gate, eventBus } = createBaishouAgentGate({
    config: agentGateConfig,
    persistConfig: () => persistBaishouAgentGateConfig(agentGateConfig)
  })
  bridgeAgentGateEventBus(eventBus)
  ensureMobileAgentGateInboxBridge(() => gate)

  void reloadAgentGateConfig().then(() => {
    // 配置重载后补拉一次，覆盖冷启动竞态
    void import('../../services/mobile-agent-gate.service').then((m) =>
      m.hydrateMobileAgentGateInbox()
    )
  })

  return {
    getAgentGate: () => gate,
    reloadAgentGateConfig,
    persistBaishouAgentGateConfig
  }
}
