import { useCallback, useEffect, useState } from 'react'
import { LayoutAnimation } from 'react-native'
import { useTranslation } from 'react-i18next'
import {
  AgentGateEffect,
  BAISHOU_AGENT_GATE_CONFIG_KEY,
  DEFAULT_AGENT_GATE_EXCLUSION_LIST,
  DEFAULT_AGENT_GATE_NOTIFICATION_PREFS,
  DEFAULT_AGENT_GATE_REPEAT_ASSERT_ASK_THRESHOLD,
  hasCatchAllAllowRule,
  setCatchAllAllowRule,
  type AgentGateNotificationPrefs,
  type BaishouAgentGateConfig,
  type AgentGateAllowlistEntry,
  type AgentGatePermissionRule,
  applyWorkspaceSecurityModeToConfig,
  type AgentWorkspaceSecurityMode
} from '@baishou/shared'
import {
  getMobileAgentGateNotificationPrefs,
  setMobileAgentGateNotificationPrefs
} from '../../../services/mobile-agent-gate-notification-prefs.service'
import { DEFAULT_BAISHOU_AGENT_GATE_CONFIG } from '@baishou/database'
import { useNativeToast } from '@baishou/ui/native'
import { useBaishou } from '../../../providers/BaishouProvider'
import { clampAgentGateRepeatThreshold } from './agent-gate-settings.util'

export function useAgentGateSettings() {
  const { t } = useTranslation()
  const toast = useNativeToast()
  const { services, dbReady, reloadAgentGateConfig } = useBaishou()
  const [config, setConfig] = useState<BaishouAgentGateConfig>(DEFAULT_BAISHOU_AGENT_GATE_CONFIG)
  const [exclusionDraft, setExclusionDraft] = useState('')
  const [ruleAction, setRuleAction] = useState('')
  const [rulePattern, setRulePattern] = useState('')
  const [ruleEffect, setRuleEffect] = useState<AgentGateEffect>(AgentGateEffect.Ask)
  const [notificationPrefs, setNotificationPrefs] = useState<AgentGateNotificationPrefs>(
    DEFAULT_AGENT_GATE_NOTIFICATION_PREFS
  )

  const loadConfig = useCallback(async () => {
    if (!services || !dbReady) return
    const saved =
      (await services.settingsManager.get<BaishouAgentGateConfig>(BAISHOU_AGENT_GATE_CONFIG_KEY)) ??
      DEFAULT_BAISHOU_AGENT_GATE_CONFIG
    setConfig({
      ...DEFAULT_BAISHOU_AGENT_GATE_CONFIG,
      ...saved,
      exclusionList: [...(saved.exclusionList ?? DEFAULT_BAISHOU_AGENT_GATE_CONFIG.exclusionList)],
      allowlist: [...(saved.allowlist ?? [])],
      permissionRules: [...(saved.permissionRules ?? [])]
    })
    setNotificationPrefs(await getMobileAgentGateNotificationPrefs())
  }, [services, dbReady])

  useEffect(() => {
    void loadConfig()
  }, [loadConfig])

  const updateNotificationPrefs = async (patch: Partial<AgentGateNotificationPrefs>) => {
    const next = await setMobileAgentGateNotificationPrefs(patch)
    setNotificationPrefs(next)
  }

  const persist = useCallback(
    async (next: BaishouAgentGateConfig) => {
      if (!services || !dbReady) return
      await services.settingsManager.set(BAISHOU_AGENT_GATE_CONFIG_KEY, next)
      setConfig(next)
      await reloadAgentGateConfig?.()
    },
    [services, dbReady, reloadAgentGateConfig]
  )

  const handleTrustToggle = (fullTrust: boolean) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    void persist(setCatchAllAllowRule(config, fullTrust))
  }

  const handleBoolToggle = (key: 'hideDeniedTools', value: boolean) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    void persist({
      ...config,
      [key]: value
    })
  }

  const handleRemoveAllowlist = async (entry: AgentGateAllowlistEntry) => {
    const next = {
      ...config,
      allowlist: config.allowlist.filter((item) => item.id !== entry.id)
    }
    try {
      await persist(next)
      toast.showSuccess(t('agent.gate.allowlist_removed', '已从白名单移除'))
    } catch {
      toast.showError(t('common.errors.save_failed', '保存失败'))
    }
  }

  const isFullTrust = hasCatchAllAllowRule(config)
  const exclusionList = config.exclusionList ?? [...DEFAULT_AGENT_GATE_EXCLUSION_LIST]
  const threshold =
    config.repeatAssertAskThreshold ?? DEFAULT_AGENT_GATE_REPEAT_ASSERT_ASK_THRESHOLD
  const permissionRules = config.permissionRules ?? []

  const addExclusion = () => {
    const action = exclusionDraft.trim()
    if (!action) return
    if (exclusionList.includes(action)) {
      setExclusionDraft('')
      return
    }
    void persist({ ...config, exclusionList: [...exclusionList, action] }).then(() =>
      setExclusionDraft('')
    )
  }

  const removeExclusion = (action: string) => {
    void persist({
      ...config,
      exclusionList: exclusionList.filter((item) => item !== action)
    })
  }

  const addPermissionRule = () => {
    const action = ruleAction.trim()
    if (!action) return
    const next: AgentGatePermissionRule = {
      action,
      effect: ruleEffect,
      ...(rulePattern.trim() ? { pattern: rulePattern.trim() } : {})
    }
    void persist({
      ...config,
      permissionRules: [...permissionRules, next]
    }).then(() => {
      setRuleAction('')
      setRulePattern('')
      setRuleEffect(AgentGateEffect.Ask)
    })
  }

  const removePermissionRule = (index: number) => {
    void persist({
      ...config,
      permissionRules: permissionRules.filter((_, i) => i !== index)
    })
  }

  const persistThreshold = (text: string) => {
    const n = clampAgentGateRepeatThreshold(text)
    if (n == null) return
    void persist({
      ...config,
      repeatAssertAskThreshold: n
    })
  }

  const persistWorkspaceMode = (mode: AgentWorkspaceSecurityMode) => {
    void persist(applyWorkspaceSecurityModeToConfig(config, mode))
  }

  return {
    config,
    exclusionDraft,
    setExclusionDraft,
    ruleAction,
    setRuleAction,
    rulePattern,
    setRulePattern,
    ruleEffect,
    setRuleEffect,
    notificationPrefs,
    updateNotificationPrefs,
    isFullTrust,
    exclusionList,
    threshold,
    permissionRules,
    handleTrustToggle,
    handleBoolToggle,
    handleRemoveAllowlist,
    addExclusion,
    removeExclusion,
    addPermissionRule,
    removePermissionRule,
    persistThreshold,
    persistWorkspaceMode
  }
}
