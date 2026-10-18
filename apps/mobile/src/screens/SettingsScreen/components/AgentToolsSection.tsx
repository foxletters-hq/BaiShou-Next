import React, { useCallback, useEffect, useMemo, useState } from 'react'
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
import { useBaishou } from '../../../providers/BaishouProvider'

export const AgentToolsSection: React.FC = () => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const cardStyles = useSettingsCardStyles()
  const router = useRouter()
  const { config, persist } = useToolManagementConfig()
  const { services, dbReady, reloadAgentGateConfig } = useBaishou()
  const [gateConfig, setGateConfig] = useState<BaishouAgentGateConfig | null>(null)
  const [behavior, setBehavior] = useState<AgentBehaviorConfig>(DEFAULT_AGENT_BEHAVIOR)
  const [behaviorReady, setBehaviorReady] = useState(false)

  const loadGateConfig = useCallback(async () => {
    if (!services || !dbReady) return
    const saved =
      (await services.settingsManager.get<BaishouAgentGateConfig>(BAISHOU_AGENT_GATE_CONFIG_KEY)) ??
      DEFAULT_BAISHOU_AGENT_GATE_CONFIG
    setGateConfig(
      foldCompanionAllowlistIntoCapabilities({
        ...DEFAULT_BAISHOU_AGENT_GATE_CONFIG,
        ...saved,
        exclusionList: [
          ...(saved.exclusionList ?? DEFAULT_BAISHOU_AGENT_GATE_CONFIG.exclusionList)
        ],
        allowlist: [...(saved.allowlist ?? [])],
        permissionRules: [...(saved.permissionRules ?? [])]
      })
    )
  }, [services, dbReady])

  useEffect(() => {
    void loadGateConfig()
  }, [loadGateConfig])

  const loadBehavior = useCallback(async () => {
    if (!services || !dbReady) return
    try {
      const saved = await services.settingsManager.get<AgentBehaviorConfig>('agent_behavior')
      setBehavior({ ...DEFAULT_AGENT_BEHAVIOR, ...(saved ?? {}) })
    } catch {
      setBehavior(DEFAULT_AGENT_BEHAVIOR)
    } finally {
      setBehaviorReady(true)
    }
  }, [services, dbReady])

  useEffect(() => {
    void loadBehavior()
  }, [loadBehavior])

  const patchBehavior = useCallback(
    async (partial: Partial<AgentBehaviorConfig>) => {
      if (!behaviorReady || !services || !dbReady) return
      const prev = behavior
      const next = { ...behavior, ...partial }
      setBehavior(next)
      try {
        await services.settingsManager.set('agent_behavior', next)
      } catch {
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
      setGateConfig(nextConfig)
      try {
        await services.settingsManager.set(BAISHOU_AGENT_GATE_CONFIG_KEY, nextConfig)
        await reloadAgentGateConfig?.()
      } catch {
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
