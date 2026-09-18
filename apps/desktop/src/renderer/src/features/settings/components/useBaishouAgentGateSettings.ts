import { useCallback, useEffect, useState } from 'react'
import {
  applyCapabilityStateToConfig,
  applyWorkspaceSecurityModeToConfig,
  capabilityStateFromConfig,
  DEFAULT_AGENT_GATE_NOTIFICATION_PREFS,
  type AgentGateAllowlistEntry,
  type AgentGateCapabilityEffect,
  type AgentGateCapabilityId,
  type AgentGateConfigScope,
  type AgentGateNotificationPrefs,
  type AgentToolScene,
  type AgentWorkspaceSecurityMode,
  type BaishouAgentGateConfig
} from '@baishou/shared'
import { scopesMatch } from './agent-gate-settings.util'

export function useBaishouAgentGateSettings(scope: AgentGateConfigScope, scene: AgentToolScene) {
  const [config, setConfig] = useState<BaishouAgentGateConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [notificationPrefs, setNotificationPrefs] = useState<AgentGateNotificationPrefs>(
    DEFAULT_AGENT_GATE_NOTIFICATION_PREFS
  )
  const [saving, setSaving] = useState(false)

  const loadConfig = useCallback(async () => {
    setLoading(true)
    try {
      const next = await window.api.settings.getBaishouAgentGateConfig(scope)
      setConfig(next)
    } catch (error) {
      console.error('[BaishouAgentGateSettings] load failed:', error)
      setConfig(null)
    } finally {
      setLoading(false)
    }
  }, [scope])

  useEffect(() => {
    void loadConfig()
    void window.api.agentGate?.getNotificationPrefs?.().then((prefs) => {
      if (prefs) setNotificationPrefs(prefs)
    })
    const unsubscribe = window.api.agentGate?.onAllowlistChanged?.((allowlist, eventScope) => {
      const effectiveScope = eventScope ?? { kind: 'companion' as const }
      if (!scopesMatch(effectiveScope, scope)) return
      setConfig((prev) => (prev ? { ...prev, allowlist } : prev))
    })
    return () => unsubscribe?.()
  }, [loadConfig, scope])

  const updateNotificationPrefs = async (patch: Partial<AgentGateNotificationPrefs>) => {
    try {
      const next = await window.api.agentGate.setNotificationPrefs(patch)
      setNotificationPrefs(next)
    } catch (error) {
      console.error('[BaishouAgentGateSettings] notification prefs failed:', error)
    }
  }

  const removeAllowlistEntry = async (entry: AgentGateAllowlistEntry) => {
    setSaving(true)
    try {
      await window.api.agentGate.removeAllowlistEntry(entry.id, scope)
      setConfig((prev) =>
        prev
          ? {
              ...prev,
              allowlist: prev.allowlist.filter((item) => item.id !== entry.id)
            }
          : prev
      )
    } catch (error) {
      console.error('[BaishouAgentGateSettings] remove allowlist entry failed:', error)
    } finally {
      setSaving(false)
    }
  }

  const patchConfig = async (patch: Partial<BaishouAgentGateConfig>) => {
    if (!config) return
    setSaving(true)
    try {
      const next = await window.api.settings.setBaishouAgentGateConfig(
        {
          ...config,
          ...patch
        },
        scope
      )
      setConfig(next)
    } catch (error) {
      console.error('[BaishouAgentGateSettings] patch config failed:', error)
    } finally {
      setSaving(false)
    }
  }

  const saveCapabilityState = async (
    effects: Partial<Record<AgentGateCapabilityId, AgentGateCapabilityEffect>>,
    trustedExternalDirs?: string[]
  ) => {
    if (!config) return
    const prevConfig = config
    const current = capabilityStateFromConfig(config, scene)
    const nextState = {
      effects: { ...current.effects, ...effects } as Record<
        AgentGateCapabilityId,
        AgentGateCapabilityEffect
      >,
      trustedExternalDirs: trustedExternalDirs ?? current.trustedExternalDirs
    }
    const nextConfig = applyCapabilityStateToConfig(config, scene, nextState)
    // 先本地更新，滑块立刻滑动；失败再回滚
    setConfig(nextConfig)
    setSaving(true)
    try {
      const saved = await window.api.settings.setBaishouAgentGateConfig(nextConfig, scope)
      setConfig(saved)
    } catch (error) {
      console.error('[BaishouAgentGateSettings] save capability failed:', error)
      setConfig(prevConfig)
    } finally {
      setSaving(false)
    }
  }

  const saveSecurityMode = async (mode: AgentWorkspaceSecurityMode) => {
    if (!config || scene !== 'workspace') return
    const prev = config
    const nextConfig = applyWorkspaceSecurityModeToConfig(config, mode)
    setConfig(nextConfig)
    setSaving(true)
    try {
      const saved = await window.api.settings.setBaishouAgentGateConfig(nextConfig, scope)
      setConfig(saved)
    } catch (error) {
      console.error('[BaishouAgentGateSettings] save security mode failed:', error)
      setConfig(prev)
    } finally {
      setSaving(false)
    }
  }

  return {
    config,
    loading,
    saving,
    notificationPrefs,
    patchConfig,
    saveCapabilityState,
    saveSecurityMode,
    removeAllowlistEntry,
    updateNotificationPrefs
  }
}
