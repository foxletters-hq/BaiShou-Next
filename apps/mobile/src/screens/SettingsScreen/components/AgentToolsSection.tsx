import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'expo-router'
import { AgentToolsView } from '@baishou/ui/native'
import {
  AgentGateEffect,
  applyCapabilityToConfig,
  BAISHOU_AGENT_GATE_CONFIG_KEY,
  capabilityStateFromConfig,
  isCompanionGateCapabilityId,
  nextDisabledToolIdsForEffect,
  resolveCompanionToolEffect,
  type BaishouAgentGateConfig
} from '@baishou/shared'
import { DEFAULT_BAISHOU_AGENT_GATE_CONFIG } from '@baishou/database'
import { useToolManagementConfig } from '../../../hooks/useToolManagementConfig'
import { useBaishou } from '../../../providers/BaishouProvider'

export const AgentToolsSection: React.FC = () => {
  const router = useRouter()
  const { config, persist } = useToolManagementConfig()
  const { services, dbReady, reloadAgentGateConfig } = useBaishou()
  const [gateConfig, setGateConfig] = useState<BaishouAgentGateConfig | null>(null)

  const loadGateConfig = useCallback(async () => {
    if (!services || !dbReady) return
    const saved =
      (await services.settingsManager.get<BaishouAgentGateConfig>(BAISHOU_AGENT_GATE_CONFIG_KEY)) ??
      DEFAULT_BAISHOU_AGENT_GATE_CONFIG
    setGateConfig({
      ...DEFAULT_BAISHOU_AGENT_GATE_CONFIG,
      ...saved,
      exclusionList: [...(saved.exclusionList ?? DEFAULT_BAISHOU_AGENT_GATE_CONFIG.exclusionList)],
      allowlist: [...(saved.allowlist ?? [])],
      permissionRules: [...(saved.permissionRules ?? [])]
    })
  }, [services, dbReady])

  useEffect(() => {
    void loadGateConfig()
  }, [loadGateConfig])

  const capabilityState = useMemo(
    () => (gateConfig ? capabilityStateFromConfig(gateConfig, 'companion') : null),
    [gateConfig]
  )

  const resolveToolEffect = useCallback(
    (toolId: string) =>
      resolveCompanionToolEffect(toolId, config.disabledToolIds, capabilityState),
    [config.disabledToolIds, capabilityState]
  )

  const saveToolEffect = useCallback(
    async (toolId: string, effect: AgentGateEffect) => {
      const nextTools = {
        ...config,
        disabledToolIds: nextDisabledToolIdsForEffect(config.disabledToolIds, toolId, effect)
      }
      await persist(nextTools)

      if (!isCompanionGateCapabilityId(toolId) || !gateConfig || !services || !dbReady) return

      const prev = gateConfig
      const nextConfig = applyCapabilityToConfig(gateConfig, 'companion', {
        capabilityId: toolId,
        effect
      })
      setGateConfig(nextConfig)
      try {
        await services.settingsManager.set(BAISHOU_AGENT_GATE_CONFIG_KEY, nextConfig)
        const { invalidateMobileMcpToolContextCache } = await import(
          '../../../services/mobile-mcp-context.service'
        )
        invalidateMobileMcpToolContextCache()
        await reloadAgentGateConfig?.()
      } catch {
        setGateConfig(prev)
      }
    },
    [config, persist, gateConfig, services, dbReady, reloadAgentGateConfig]
  )

  return (
    <AgentToolsView
      config={config}
      onChange={persist}
      resolveToolEffect={resolveToolEffect}
      onToolEffectChange={(toolId, effect) => {
        void saveToolEffect(toolId, effect)
      }}
      disableScroll
      onOpenEmojiSettings={() => router.push('/settings/emoji')}
    />
  )
}
