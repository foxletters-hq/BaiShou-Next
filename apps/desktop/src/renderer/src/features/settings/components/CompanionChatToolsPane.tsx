import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AgentToolsCommunityTab,
  Input,
  SegmentedControl,
  SettingsPageChrome
} from '@baishou/ui'
import { getDefaultToolManagementConfig } from '@baishou/store'
import {
  AGENT_TOOL_CATEGORY_ORDER,
  AGENT_TOOL_UI_DEFS,
  AgentGateEffect,
  applyCapabilityToConfig,
  capabilityStateFromConfig,
  companionToolEffectOptions,
  DEFAULT_AGENT_GATE_NOTIFICATION_PREFS,
  isCompanionGateCapabilityId,
  nextDisabledToolIdsForEffect,
  resolveCompanionToolEffect,
  type AgentBehaviorConfig,
  type AgentGateCapabilityId,
  type AgentGateNotificationPrefs,
  type AgentToolCategory,
  type BaishouAgentGateConfig
} from '@baishou/shared'
import styles from './AgentToolsPane.module.css'
import gateStyles from './AgentGateSettings.module.css'
import pane from './GeneralSettingsPane.module.css'
import '@baishou/ui/desktop/shared/SettingsListTile.css'

interface CompanionChatToolsPaneProps {
  settings: {
    agentBehavior?: AgentBehaviorConfig | null
    toolManagementConfig?: ReturnType<typeof getDefaultToolManagementConfig>
    setAgentBehaviorConfig: (config: AgentBehaviorConfig) => Promise<void>
    setToolManagementConfig: (config: ReturnType<typeof getDefaultToolManagementConfig>) => void
  }
}

const FALLBACK_BEHAVIOR: AgentBehaviorConfig = {
  agentContextWindowSize: 20,
  companionCompressTokens: 8000,
  companionTruncateTokens: 4000,
  agentPersona: '',
  agentGuidelines: '',
  pinnedAssistantIds: [],
  restoreLastSessionOnReturn: true,
  reasoningEffortDefault: 'auto'
}

const TOOL_NAME_FALLBACKS: Record<string, string> = {
  'agent.tools.diary_read': '日记读取',
  'agent.tools.diary_write': '日记写入',
  'agent.tools.diary_edit': '日记编辑',
  'agent.tools.diary_delete': '日记删除',
  'agent.tools.diary_list': '日记列表',
  'agent.tools.diary_search': '日记搜索',
  'agent.tools.summary_read': '总结读取',
  'agent.tools.message_search': '消息搜索',
  'agent.tools.vector_search': '语义搜索',
  'agent.tools.memory_store': '记忆存储',
  'agent.tools.memory_delete': '记忆删除',
  'agent.tools.recall_relations': '回忆人生关系图',
  'agent.tools.graph_upsert': '写入人生关系图',
  'agent.tools.web_search': '网络搜索',
  'agent.tools.url_read': '网页读取',
  'agent.tools.skill_write': '保存技能',
  'agent.tools.auto_inject_time': '当前时间',
  'agent.tools.current_time': '查询时间'
}

const TOOL_HINT_FALLBACKS: Record<string, string> = {
  'agent.tools.recall_relations_tooltip':
    '按人名、地点或事件查找人生关系图：可搜索实体、查看邻居，或走关系路径并带回日记摘录。只读，不含笔记本内关系。',
  'agent.tools.graph_upsert_tooltip':
    '把人物、地点、事件及其关系写入人生关系图，写完立即生效。精确同名会更新该节点，不会把两个节点合并。可以改或删已有关系。合并请在图页自己操作。',
  'agent.tools.skill_write_tooltip':
    '创建或更新软件级技能说明，写入用户主目录的技能目录。默认每次保存前询问。'
}

const CATEGORY_LABEL: Record<AgentToolCategory, [string, string]> = {
  diary: ['settings.agent_tools_category_diary', '日记工具'],
  summary: ['settings.agent_tools_category_summary', '总结工具'],
  memory: ['settings.agent_tools_category_memory', '记忆工具'],
  search: ['settings.agent_tools_category_search', '搜索工具'],
  general: ['settings.agent_tools_category_general', '通用工具']
}

function scopesMatch(
  a?: { kind: string; workspaceId?: string },
  b?: { kind: string; workspaceId?: string }
): boolean {
  if (!a && !b) return true
  if (!a || !b) return false
  return a.kind === b.kind
}

/** 伙伴对话：常规设置 + 每个工具允许/询问/拒绝 */
export const CompanionChatToolsPane: React.FC<CompanionChatToolsPaneProps> = ({ settings }) => {
  const { t } = useTranslation()
  const [gateConfig, setGateConfig] = useState<BaishouAgentGateConfig | null>(null)
  const [saving, setSaving] = useState(false)
  const [notificationPrefs, setNotificationPrefs] = useState<AgentGateNotificationPrefs>(
    DEFAULT_AGENT_GATE_NOTIFICATION_PREFS
  )

  const companionTools = settings.toolManagementConfig ?? getDefaultToolManagementConfig()
  const behavior: AgentBehaviorConfig = {
    ...FALLBACK_BEHAVIOR,
    ...(settings.agentBehavior ?? {})
  }
  const restoreLastSessionOnReturn = behavior.restoreLastSessionOnReturn !== false
  const behaviorReady = Boolean(settings.agentBehavior)
  const capabilityState = useMemo(
    () => (gateConfig ? capabilityStateFromConfig(gateConfig, 'companion') : null),
    [gateConfig]
  )

  const loadGateConfig = useCallback(async () => {
    try {
      const next = await window.api.settings.getBaishouAgentGateConfig({ kind: 'companion' })
      setGateConfig(next)
    } catch (error) {
      console.error('[CompanionChatTools] load gate failed:', error)
      setGateConfig(null)
    }
  }, [])

  useEffect(() => {
    void loadGateConfig()
    void window.api.agentGate?.getNotificationPrefs?.().then((prefs) => {
      if (prefs) setNotificationPrefs(prefs)
    })
    const unsubscribe = window.api.agentGate?.onAllowlistChanged?.((allowlist, eventScope) => {
      const effectiveScope = eventScope ?? { kind: 'companion' as const }
      if (!scopesMatch(effectiveScope, { kind: 'companion' })) return
      setGateConfig((prev) => (prev ? { ...prev, allowlist } : prev))
    })
    return () => unsubscribe?.()
  }, [loadGateConfig])

  const patchBehavior = (partial: Partial<AgentBehaviorConfig>) => {
    if (!behaviorReady) return
    void settings.setAgentBehaviorConfig({ ...behavior, ...partial })
  }

  const updateNotificationPrefs = async (patch: Partial<AgentGateNotificationPrefs>) => {
    try {
      const next = await window.api.agentGate.setNotificationPrefs(patch)
      setNotificationPrefs(next)
    } catch (error) {
      console.error('[CompanionChatTools] notification prefs failed:', error)
    }
  }

  const syncDisabledTool = (
    toolId: string,
    effect: AgentGateEffect,
    tools = companionTools
  ) => {
    settings.setToolManagementConfig({
      ...tools,
      disabledToolIds: nextDisabledToolIdsForEffect(tools.disabledToolIds, toolId, effect)
    })
  }

  const saveToolEffect = async (toolId: AgentGateCapabilityId, effect: AgentGateEffect) => {
    if (!gateConfig) return
    const prev = gateConfig
    const nextConfig = applyCapabilityToConfig(gateConfig, 'companion', {
      capabilityId: toolId,
      effect
    })
    setGateConfig(nextConfig)
    setSaving(true)
    try {
      await Promise.resolve(syncDisabledTool(toolId, effect))
      const saved = await window.api.settings.setBaishouAgentGateConfig(nextConfig, {
        kind: 'companion'
      })
      setGateConfig(saved)
    } catch (error) {
      console.error('[CompanionChatTools] save tool effect failed:', error)
      setGateConfig(prev)
    } finally {
      setSaving(false)
    }
  }

  const resolveToolEffect = (toolId: string): AgentGateEffect =>
    resolveCompanionToolEffect(toolId, companionTools.disabledToolIds, capabilityState)

  const effectLabel = (effect: AgentGateEffect) => {
    if (effect === AgentGateEffect.Allow) return t('settings.agent_gate_effect_allow', '允许')
    if (effect === AgentGateEffect.Deny) return t('settings.agent_gate_effect_deny', '拒绝')
    return t('settings.agent_gate_effect_ask', '询问')
  }

  return (
    <div
      className="settings-pane settings-pane-full"
      style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
    >
      <SettingsPageChrome title={t('settings.companion_chat_tools_title', '伙伴对话')} layout="stack">
        <div className={styles.page}>
          <div className={styles.tabBody}>
            <div className={styles.scrollPane}>
              <div className={pane.stackGroup}>
                <div className={pane.sectionLabelRow}>
                  <h3 className={pane.sectionLabel}>
                    {t('settings.companion_chat_general_section', '常规')}
                  </h3>
                </div>
                <section className={pane.cardSection}>
                  <div className={`${pane.cardBody} ${gateStyles.paddedBody}`}>
                    <div className="settings-list-tile settings-list-tile-noclick">
                      <div className="settings-list-tile-content">
                        <span className="settings-list-tile-title">
                          {t('settings.restore_last_session_on_return', '返回后继续上次会话')}
                        </span>
                        <span className="settings-list-tile-subtitle">
                          {t(
                            'settings.restore_last_session_on_return_hint',
                            '关闭后进入伙伴页会停留在空白对话，不再自动打开上次会话。'
                          )}
                        </span>
                      </div>
                      <label className={`settings-switch-label ${gateStyles.compactSwitch}`}>
                        <input
                          type="checkbox"
                          checked={restoreLastSessionOnReturn}
                          disabled={!behaviorReady}
                          onChange={(e) =>
                            patchBehavior({ restoreLastSessionOnReturn: e.target.checked })
                          }
                        />
                        <span className="settings-switch-slider" />
                      </label>
                    </div>
                    <div className={pane.divider} />
                    <div className="settings-list-tile settings-list-tile-noclick">
                      <div className="settings-list-tile-content">
                        <span className="settings-list-tile-title">
                          {t('settings.agent_gate_notify_enabled', '系统通知')}
                        </span>
                        <span className="settings-list-tile-subtitle">
                          {t(
                            'settings.agent_gate_notifications_hint',
                            '伙伴需要你确认操作时，用系统通知提醒。'
                          )}
                        </span>
                      </div>
                      <label className={`settings-switch-label ${gateStyles.compactSwitch}`}>
                        <input
                          type="checkbox"
                          checked={notificationPrefs.enabled}
                          disabled={saving}
                          onChange={(e) => void updateNotificationPrefs({ enabled: e.target.checked })}
                        />
                        <span className="settings-switch-slider" />
                      </label>
                    </div>
                    <div className={pane.divider} />
                    <div className="settings-list-tile settings-list-tile-noclick">
                      <div className="settings-list-tile-content">
                        <span className="settings-list-tile-title">
                          {t('settings.agent_gate_notify_sound', '通知声音')}
                        </span>
                      </div>
                      <label className={`settings-switch-label ${gateStyles.compactSwitch}`}>
                        <input
                          type="checkbox"
                          checked={notificationPrefs.soundEnabled}
                          disabled={saving || !notificationPrefs.enabled}
                          onChange={(e) =>
                            void updateNotificationPrefs({ soundEnabled: e.target.checked })
                          }
                        />
                        <span className="settings-switch-slider" />
                      </label>
                    </div>
                  </div>
                </section>
              </div>

              <AgentToolsCommunityTab
                config={companionTools}
                onConfigChange={(config) => settings.setToolManagementConfig(config)}
              />

              {AGENT_TOOL_CATEGORY_ORDER.map((category) => {
                const tools = AGENT_TOOL_UI_DEFS.filter((tool) => tool.category === category)
                if (tools.length === 0) return null
                const [labelKey, labelFallback] = CATEGORY_LABEL[category]
                return (
                  <div key={category} className={pane.stackGroup}>
                    <div className={pane.sectionLabelRow}>
                      <h3 className={pane.sectionLabel}>{t(labelKey, labelFallback)}</h3>
                    </div>
                    <section className={pane.cardSection}>
                      <div className={`${pane.cardBody} ${gateStyles.paddedBody}`}>
                        {tools.map((tool, index) => {
                          const current = resolveToolEffect(tool.id)
                          const isUiOnly = tool.id === 'auto_inject_time'
                          const options = companionToolEffectOptions(tool.id)
                          const param = tool.configurableParams?.[0]

                          return (
                            <React.Fragment key={tool.id}>
                              {index > 0 ? <div className={pane.divider} /> : null}
                              <div className={gateStyles.matrixRow}>
                                <div className={gateStyles.matrixText}>
                                  <div className={gateStyles.matrixTitle}>
                                    {t(tool.nameKey, TOOL_NAME_FALLBACKS[tool.nameKey] ?? tool.id)}
                                  </div>
                                  <div className={gateStyles.matrixHint}>
                                    {t(tool.tooltipKey, TOOL_HINT_FALLBACKS[tool.tooltipKey] ?? '')}
                                  </div>
                                </div>
                                <SegmentedControl
                                  aria-label={t(
                                    tool.nameKey,
                                    TOOL_NAME_FALLBACKS[tool.nameKey] ?? tool.id
                                  )}
                                  value={current}
                                  options={options.map((effect) => ({
                                    value: effect,
                                    label: effectLabel(effect)
                                  }))}
                                  onChange={(effect) => {
                                    if (isUiOnly) {
                                      syncDisabledTool(tool.id, effect)
                                      return
                                    }
                                    if (!isCompanionGateCapabilityId(tool.id)) return
                                    void saveToolEffect(tool.id, effect)
                                  }}
                                />
                              </div>
                              {param && current !== AgentGateEffect.Deny ? (
                                <div className="settings-list-tile settings-list-tile-noclick">
                                  <div className="settings-list-tile-content">
                                    <span className="settings-list-tile-title">
                                      {t(param.labelKey, param.key)}
                                    </span>
                                  </div>
                                  <Input
                                    fieldSize="small"
                                    className={gateStyles.compactNumberInput}
                                    inputClassName={gateStyles.compactNumberInputField}
                                    type="number"
                                    min={param.min ?? 1}
                                    max={param.max ?? 50}
                                    value={
                                      Number(
                                        companionTools.customConfigs?.[tool.id]?.[param.key] ??
                                          param.defaultValue
                                      ) || Number(param.defaultValue) || 10
                                    }
                                    onChange={(e) => {
                                      const n = Number(e.target.value)
                                      if (!Number.isFinite(n)) return
                                      const clamped = Math.max(
                                        param.min ?? 1,
                                        Math.min(param.max ?? 50, Math.floor(n))
                                      )
                                      settings.setToolManagementConfig({
                                        ...companionTools,
                                        customConfigs: {
                                          ...companionTools.customConfigs,
                                          [tool.id]: {
                                            ...(companionTools.customConfigs?.[tool.id] ?? {}),
                                            [param.key]: clamped
                                          }
                                        }
                                      })
                                    }}
                                  />
                                </div>
                              ) : null}
                            </React.Fragment>
                          )
                        })}
                      </div>
                    </section>
                  </div>
                )
              })}

              {gateConfig && gateConfig.allowlist.length > 0 ? (
                <div className={pane.stackGroup}>
                  <div className={pane.sectionLabelRow}>
                    <h3 className={pane.sectionLabel}>
                      {t('settings.agent_gate_allowlist_title', '始终允许列表')}
                    </h3>
                  </div>
                  <section className={pane.cardSection}>
                    <div className={`${pane.cardBody} ${gateStyles.paddedBody}`}>
                      {gateConfig.allowlist.map((entry, index) => (
                        <React.Fragment key={entry.id}>
                          {index > 0 ? <div className={pane.divider} /> : null}
                          <div className="settings-list-tile settings-list-tile-noclick">
                            <div className="settings-list-tile-content">
                              <span className="settings-list-tile-title">{entry.action}</span>
                              <span className="settings-list-tile-subtitle">
                                {entry.pattern
                                  ? t('settings.agent_gate_allowlist_pattern', '模式：{{pattern}}', {
                                      pattern: entry.pattern
                                    })
                                  : t('settings.agent_gate_allowlist_whole_action', '整工具放行')}
                              </span>
                            </div>
                            <button
                              type="button"
                              className="settings-text-btn"
                              disabled={saving}
                              onClick={() => {
                                void (async () => {
                                  setSaving(true)
                                  try {
                                    await window.api.agentGate.removeAllowlistEntry(entry.id, {
                                      kind: 'companion'
                                    })
                                    setGateConfig((prev) =>
                                      prev
                                        ? {
                                            ...prev,
                                            allowlist: prev.allowlist.filter(
                                              (item) => item.id !== entry.id
                                            )
                                          }
                                        : prev
                                    )
                                  } catch (error) {
                                    console.error(
                                      '[CompanionChatTools] remove allowlist failed:',
                                      error
                                    )
                                  } finally {
                                    setSaving(false)
                                  }
                                })()
                              }}
                            >
                              {t('common.remove', '移除')}
                            </button>
                          </div>
                        </React.Fragment>
                      ))}
                    </div>
                  </section>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </SettingsPageChrome>
    </div>
  )
}
