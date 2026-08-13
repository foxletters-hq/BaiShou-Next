import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AgentToolsView, ReasoningEffortSelect, SegmentedControl, SettingsPageChrome } from '@baishou/ui'
import { getDefaultToolManagementConfig } from '@baishou/store'
import type { AgentBehaviorConfig, ReasoningEffortSetting } from '@baishou/shared'
import { normalizeReasoningEffortSetting } from '@baishou/shared'
import { BaishouAgentGateSettingsSection } from './BaishouAgentGateSettingsSection'
import styles from './AgentToolsPane.module.css'
import gateStyles from './AgentGateSettings.module.css'
import pane from './GeneralSettingsPane.module.css'
import '@baishou/ui/desktop/shared/SettingsListTile.css'

interface CompanionChatToolsPaneProps {
  settings: any
}

type CompanionGateTab = 'permissions' | 'tools'

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

/** 伙伴对话：日记/记忆能力矩阵 + 工具开关（与工作台配置隔离） */
export const CompanionChatToolsPane: React.FC<CompanionChatToolsPaneProps> = ({ settings }) => {
  const { t } = useTranslation()
  const [tab, setTab] = useState<CompanionGateTab>('permissions')
  const [toolsSubpageActive, setToolsSubpageActive] = useState(false)
  const companionTools = settings.toolManagementConfig ?? getDefaultToolManagementConfig()
  const hideTabHeader = tab === 'tools' && toolsSubpageActive
  const behavior: AgentBehaviorConfig = {
    ...FALLBACK_BEHAVIOR,
    ...(settings.agentBehavior ?? {})
  }
  const restoreLastSessionOnReturn = behavior.restoreLastSessionOnReturn !== false
  const reasoningEffortDefault = normalizeReasoningEffortSetting(behavior.reasoningEffortDefault)

  const patchBehavior = (partial: Partial<AgentBehaviorConfig>) => {
    void settings.setAgentBehaviorConfig({ ...behavior, ...partial })
  }

  return (
    <div
      className="settings-pane settings-pane-full"
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      <SettingsPageChrome
        title={t('settings.companion_chat_tools_title', '伙伴对话')}
        layout="stack"
      >
        <div className={styles.page}>
          {hideTabHeader ? null : (
            <>
              <div className={styles.tabHeader}>
                <div className={styles.navStacks}>
                  <SegmentedControl
                    value={tab}
                    options={[
                      {
                        value: 'permissions',
                        label: t('settings.agent_tools_tab_companion_permissions', '权限')
                      },
                      {
                        value: 'tools',
                        label: t('settings.agent_tools_tab_companion_tools', '工具')
                      }
                    ]}
                    onChange={setTab}
                  />
                </div>
              </div>
            </>
          )}

          <div className={styles.tabBody}>
            {tab === 'permissions' ? (
              <div className={styles.scrollPane}>
                <div className={pane.stackGroup}>
                  <div className={pane.sectionLabelRow}>
                    <h3 className={pane.sectionLabel}>
                      {t('settings.companion_chat_session_section', '会话')}
                    </h3>
                  </div>
                  <section className={pane.cardSection}>
                    <div className={`${pane.cardBody} ${gateStyles.paddedBody}`}>
                      <div className="settings-list-tile settings-list-tile-noclick">
                        <div className="settings-list-tile-content">
                          <span className="settings-list-tile-title">
                            {t(
                              'settings.restore_last_session_on_return',
                              '每次返回页面，默认打开上次对话'
                            )}
                          </span>
                          <span className="settings-list-tile-subtitle">
                            {t(
                              'settings.restore_last_session_on_return_hint',
                              '关闭后进入伙伴页会停留在空白对话，不再自动恢复上次会话。'
                            )}
                          </span>
                        </div>
                        <label className={`settings-switch-label ${gateStyles.compactSwitch}`}>
                          <input
                            type="checkbox"
                            checked={restoreLastSessionOnReturn}
                            onChange={(e) =>
                              patchBehavior({ restoreLastSessionOnReturn: e.target.checked })
                            }
                          />
                          <span className="settings-switch-slider" />
                        </label>
                      </div>
                      <div className="settings-list-tile settings-list-tile-noclick">
                        <div className="settings-list-tile-content">
                          <span className="settings-list-tile-title">
                            {t('agent.reasoning.effort_label', '思考强度')}
                          </span>
                          <span className="settings-list-tile-subtitle">
                            {t(
                              'agent.reasoning.effort_hint',
                              '控制推理模型思考深度。Default 表示使用模型默认档位。'
                            )}
                          </span>
                        </div>
                        <ReasoningEffortSelect
                          value={reasoningEffortDefault}
                          onChange={(value: ReasoningEffortSetting) =>
                            patchBehavior({ reasoningEffortDefault: value })
                          }
                        />
                      </div>
                    </div>
                  </section>
                </div>
                <BaishouAgentGateSettingsSection scene="companion" scope={{ kind: 'companion' }} />
              </div>
            ) : (
              <div className={styles.toolsPane}>
                <AgentToolsView
                  scene="companion"
                  config={companionTools}
                  onChange={(config) => settings.setToolManagementConfig(config)}
                  onSubpageActiveChange={setToolsSubpageActive}
                />
              </div>
            )}
          </div>
        </div>
      </SettingsPageChrome>
    </div>
  )
}
