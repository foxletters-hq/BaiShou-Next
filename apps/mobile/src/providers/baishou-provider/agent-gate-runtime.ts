import {
  BAISHOU_AGENT_GATE_CONFIG_KEY,
  type BaishouAgentGateConfig
} from '@baishou/shared'
import {
  bridgeAgentGateEventBus,
  cloneBaishouAgentGateConfig,
  createBaishouAgentGate,
  type IBaishouAgentGate
} from '@baishou/ai'
import { DEFAULT_BAISHOU_AGENT_GATE_CONFIG } from '@baishou/database'
import { ensureMobileAgentGateBridge } from '../../services/mobile-agent-gate.service'

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
    Object.assign(agentGateConfig, {
      trustMode: config.trustMode,
      exclusionList: [...(config.exclusionList ?? [])],
      allowlist: [...(config.allowlist ?? [])],
      actionRules: config.actionRules ? { ...config.actionRules } : undefined,
      permissionRules: config.permissionRules?.map((rule) => ({ ...rule })),
      forceAskExternalPath: config.forceAskExternalPath,
      repeatAssertAskThreshold: config.repeatAssertAskThreshold,
      hideDeniedTools: config.hideDeniedTools
    })
    await settingsManager.set(BAISHOU_AGENT_GATE_CONFIG_KEY, agentGateConfig)
  }

  const reloadAgentGateConfig = async () => {
    const saved = await settingsManager.get<BaishouAgentGateConfig>(BAISHOU_AGENT_GATE_CONFIG_KEY)
    const next = cloneBaishouAgentGateConfig(saved ?? DEFAULT_BAISHOU_AGENT_GATE_CONFIG)
    Object.assign(agentGateConfig, next)
  }

  const { gate, eventBus } = createBaishouAgentGate({
    config: agentGateConfig,
    persistConfig: () => persistBaishouAgentGateConfig(agentGateConfig)
  })
  bridgeAgentGateEventBus(eventBus)
  ensureMobileAgentGateBridge()

  void reloadAgentGateConfig()

  return {
    getAgentGate: () => gate,
    reloadAgentGateConfig,
    persistBaishouAgentGateConfig
  }
}
