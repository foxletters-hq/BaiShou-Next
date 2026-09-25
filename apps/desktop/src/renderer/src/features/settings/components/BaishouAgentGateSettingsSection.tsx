import React from 'react'
import { useTranslation } from 'react-i18next'
import type { AgentGateConfigScope, AgentToolScene } from '@baishou/shared'
import { AgentGateCompanionForm } from './AgentGateCompanionForm'
import { useBaishouAgentGateSettings } from './useBaishouAgentGateSettings'
import { WorkspaceGatePermissionsPanel } from './WorkspaceGatePermissionsPanel'
import pane from './GeneralSettingsPane.module.css'
import styles from './AgentGateSettings.module.css'

export interface BaishouAgentGateSettingsSectionProps {
  scene?: AgentToolScene
  scope?: AgentGateConfigScope
  onSubpageActiveChange?: (active: boolean) => void
}

export const BaishouAgentGateSettingsSection: React.FC<BaishouAgentGateSettingsSectionProps> = ({
  scene: sceneProp = 'companion',
  scope = { kind: 'companion' },
  onSubpageActiveChange
}) => {
  const scene: AgentToolScene = sceneProp
  const { t } = useTranslation()
  const {
    config,
    loading,
    saving,
    notificationPrefs,
    patchConfig,
    saveCapabilityState,
    saveSecurityMode,
    removeAllowlistEntry,
    updateNotificationPrefs
  } = useBaishouAgentGateSettings(scope, scene)

  if (loading && !config) {
    return (
      <div className={pane.stack}>
        <div className={pane.stackGroup}>
          <div className={pane.sectionLabelRow}>
            <h3 className={pane.sectionLabel}>
              {scene === 'workspace'
                ? t('settings.agent_security_mode', 'Agent 安全模式')
                : t('settings.agent_gate_title', '伙伴操作门控')}
            </h3>
          </div>
          <section className={pane.cardSection}>
            <div className={`${pane.cardBody} ${styles.paddedBody}`}>
              <p className={styles.emptyHint}>{t('common.loading', '加载中...')}</p>
            </div>
          </section>
        </div>
      </div>
    )
  }

  if (!config) return null

  if (sceneProp === 'workspace') {
    return (
      <WorkspaceGatePermissionsPanel
        config={config}
        saving={saving}
        notificationPrefs={notificationPrefs}
        onSaveSecurityMode={saveSecurityMode}
        onPatchConfig={patchConfig}
        onRemoveAllowlistEntry={removeAllowlistEntry}
        onUpdateNotificationPrefs={updateNotificationPrefs}
        onSubpageActiveChange={onSubpageActiveChange}
      />
    )
  }

  return (
    <AgentGateCompanionForm
      scene={scene}
      config={config}
      saving={saving}
      notificationPrefs={notificationPrefs}
      onSaveCapability={saveCapabilityState}
      onPatchConfig={patchConfig}
      onRemoveAllowlistEntry={removeAllowlistEntry}
      onUpdateNotificationPrefs={updateNotificationPrefs}
    />
  )
}
