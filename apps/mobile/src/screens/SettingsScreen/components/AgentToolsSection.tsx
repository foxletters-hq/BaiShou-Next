import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import {
  AgentToolsView,
  SettingsGroupCard,
  Switch,
  useNativeTheme,
  useSettingsCardStyles
} from '@baishou/ui/native'
import {
  AgentGateEffect,
  applyCapabilityToConfig,
  BAISHOU_AGENT_GATE_CONFIG_KEY,
  capabilityStateFromConfig,
  foldCompanionAllowlistIntoCapabilities,
  isCompanionGateCapabilityId,
  nextDisabledToolIdsForEffect,
  resolveCompanionToolEffect,
  stripCompanionAllowlistActions,
  type AgentBehaviorConfig,
  type BaishouAgentGateConfig
} from '@baishou/shared'
import { DEFAULT_AGENT_BEHAVIOR, DEFAULT_BAISHOU_AGENT_GATE_CONFIG } from '@baishou/database'
import { useToolManagementConfig } from '../../../hooks/useToolManagementConfig'
import { logNavigationPhase } from '../../../navigation/transitionDiagnostics'
import { useBaishou } from '../../../providers/BaishouProvider'

let cachedGateConfig: BaishouAgentGateConfig | null = null
let cachedBehaviorConfig: AgentBehaviorConfig | null = null

export const AgentToolsSection: React.FC = () => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const cardStyles = useSettingsCardStyles()
  const router = useRouter()
  const { config, persist } = useToolManagementConfig()
  const { services, dbReady, reloadAgentGateConfig } = useBaishou()
  const [gateConfig, setGateConfig] = useState<BaishouAgentGateConfig | null>(
    () => cachedGateConfig
  )
  const [behavior, setBehavior] = useState<AgentBehaviorConfig>(
    () => cachedBehaviorConfig ?? DEFAULT_AGENT_BEHAVIOR
  )
  const [behaviorReady, setBehaviorReady] = useState(() => cachedBehaviorConfig !== null)
  const renderCountRef = useRef(0)
  renderCountRef.current += 1

  useEffect(() => {
    logNavigationPhase('agent-tools', 'AgentToolsSection:mount', {
      renderCount: renderCountRef.current,
      cachedGateHit: cachedGateConfig !== null,
      cachedBehaviorHit: cachedBehaviorConfig !== null
    })
  }, [])

  const loadSectionData = useCallback(async () => {
    if (!services || !dbReady) return
    const loadStart = Date.now()
    logNavigationPhase('agent-tools', 'AgentToolsSection:dbLoadStart')
    try {
      const [savedGate, savedBehavior] = await Promise.all([
        services.settingsManager.get<BaishouAgentGateConfig>(BAISHOU_AGENT_GATE_CONFIG_KEY),
        services.settingsManager.get<AgentBehaviorConfig>('agent_behavior').catch(() => undefined)
      ])
      const resolvedGate = savedGate ?? DEFAULT_BAISHOU_AGENT_GATE_CONFIG
      const nextGate = foldCompanionAllowlistIntoCapabilities({
        ...DEFAULT_BAISHOU_AGENT_GATE_CONFIG,
        ...resolvedGate,
        exclusionList: [
          ...(resolvedGate.exclusionList ?? DEFAULT_BAISHOU_AGENT_GATE_CONFIG.exclusionList)
        ],
        allowlist: [...(resolvedGate.allowlist ?? [])],
        permissionRules: [...(resolvedGate.permissionRules ?? [])]
      })
      const nextBehavior: AgentBehaviorConfig = {
        ...DEFAULT_AGENT_BEHAVIOR,
        ...(savedBehavior ?? {})
      }
      cachedGateConfig = nextGate
      cachedBehaviorConfig = nextBehavior
      setGateConfig(nextGate)
      setBehavior(nextBehavior)
      setBehaviorReady(true)
      logNavigationPhase('agent-tools', 'AgentToolsSection:dbLoadDone', {
        costMs: Date.now() - loadStart,
        renderCount: renderCountRef.current,
        restoreLastSessionOnReturn: nextBehavior.restoreLastSessionOnReturn
      })
    } catch (error) {
      setBehavior(DEFAULT_AGENT_BEHAVIOR)
      setBehaviorReady(true)
      logNavigationPhase('agent-tools', 'AgentToolsSection:dbLoadError', {
        costMs: Date.now() - loadStart,
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }, [services, dbReady])

  useEffect(() => {
    void loadSectionData()
  }, [loadSectionData])

  const patchBehavior = useCallback(
    async (partial: Partial<AgentBehaviorConfig>) => {
      if (!behaviorReady || !services || !dbReady) return
      const prev = behavior
      const next = { ...behavior, ...partial }
      cachedBehaviorConfig = next
      setBehavior(next)
      try {
        await services.settingsManager.set('agent_behavior', next)
      } catch {
        cachedBehaviorConfig = prev
        setBehavior(prev)
      }
    },
    [behavior, behaviorReady, services, dbReady]
  )

  const capabilityState = useMemo(
    () => (gateConfig ? capabilityStateFromConfig(gateConfig, 'companion') : null),
    [gateConfig]
  )

  const resolveToolEffect = useCallback(
    (toolId: string) => resolveCompanionToolEffect(toolId, config.disabledToolIds, capabilityState),
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
      const nextConfig = foldCompanionAllowlistIntoCapabilities(
        stripCompanionAllowlistActions(
          applyCapabilityToConfig(gateConfig, 'companion', {
            capabilityId: toolId,
            effect
          }),
          [toolId]
        )
      )
      cachedGateConfig = nextConfig
      setGateConfig(nextConfig)
      try {
        await services.settingsManager.set(BAISHOU_AGENT_GATE_CONFIG_KEY, nextConfig)
        await reloadAgentGateConfig?.()
      } catch {
        cachedGateConfig = prev
        setGateConfig(prev)
      }
    },
    [config, persist, gateConfig, services, dbReady, reloadAgentGateConfig]
  )

  return (
    <>
      <SettingsGroupCard>
        <Text style={[cardStyles.cardTitle, { color: colors.textPrimary }]}>
          {t('settings.companion_chat_general_section', '常规')}
        </Text>
        <View style={cardStyles.row}>
          <View style={cardStyles.rowText}>
            <Text style={[cardStyles.label, { color: colors.textPrimary }]}>
              {t('settings.restore_last_session_on_return', '返回后继续上次会话')}
            </Text>
            <Text style={[cardStyles.hint, { color: colors.textSecondary }]}>
              {t(
                'settings.restore_last_session_on_return_hint',
                '关闭后进入伙伴页会停留在空白对话，不再自动打开上次会话。'
              )}
            </Text>
          </View>
          <Switch
            value={behavior.restoreLastSessionOnReturn !== false}
            disabled={!behaviorReady}
            onValueChange={(checked) => {
              void patchBehavior({ restoreLastSessionOnReturn: checked })
            }}
          />
        </View>
      </SettingsGroupCard>
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
    </>
  )
}
