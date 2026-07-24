import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AgentToolsView, SegmentedControl, SettingsPageChrome } from '@baishou/ui'
import { getDefaultToolManagementConfig } from '@baishou/store'
import { BaishouAgentGateSettingsSection } from './BaishouAgentGateSettingsSection'
import styles from './AgentToolsPane.module.css'

interface CompanionChatToolsPaneProps {
  settings: any
}

type CompanionGateTab = 'permissions' | 'tools'

/** 伙伴对话：日记/记忆能力矩阵 + 工具开关（与工作台配置隔离） */
export const CompanionChatToolsPane: React.FC<CompanionChatToolsPaneProps> = ({ settings }) => {
  const { t } = useTranslation()
  const [tab, setTab] = useState<CompanionGateTab>('permissions')
  const [toolsSubpageActive, setToolsSubpageActive] = useState(false)
  const companionTools = settings.toolManagementConfig ?? getDefaultToolManagementConfig()
  const hideTabHeader = tab === 'tools' && toolsSubpageActive

  return (
    <div
      className="settings-pane settings-pane-full"
      style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
    >
      <SettingsPageChrome title={t('settings.companion_chat_tools_title', '伙伴对话')} layout="stack">
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
                <BaishouAgentGateSettingsSection
                  scene="companion"
                  scope={{ kind: 'companion' }}
                />
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
