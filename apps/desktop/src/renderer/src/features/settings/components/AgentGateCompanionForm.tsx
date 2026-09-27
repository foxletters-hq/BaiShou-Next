import React from 'react'
import { useTranslation } from 'react-i18next'
import {
  type AgentGateCapabilityEffect,
  type AgentGateCapabilityId,
  type AgentGateNotificationPrefs,
  type AgentToolScene,
  type BaishouAgentGateConfig
} from '@baishou/shared'
import { HelpTooltip, Switch } from '@baishou/ui'
import '@baishou/ui/desktop/shared/SettingsListTile.css'
import { AgentGateAdvancedRulesSection } from './AgentGateAdvancedRulesSection'
import { AgentGateCapabilityMatrix } from './AgentGateCapabilityMatrix'
import pane from './GeneralSettingsPane.module.css'
import styles from './AgentGateSettings.module.css'

export interface AgentGateCompanionFormProps {
  scene: AgentToolScene
  config: BaishouAgentGateConfig
  saving: boolean
  notificationPrefs: AgentGateNotificationPrefs
  onSaveCapability: (
    effects: Partial<Record<AgentGateCapabilityId, AgentGateCapabilityEffect>>
  ) => void | Promise<void>
  onPatchConfig: (patch: Partial<BaishouAgentGateConfig>) => void | Promise<void>
  onUpdateNotificationPrefs: (patch: Partial<AgentGateNotificationPrefs>) => void | Promise<void>
}

export const AgentGateCompanionForm: React.FC<AgentGateCompanionFormProps> = ({
  scene,
  config,
  saving,
  notificationPrefs,
  onSaveCapability,
  onPatchConfig,
  onUpdateNotificationPrefs
}) => {
  const { t } = useTranslation()

  return (
    <div className={pane.stack}>
      <AgentGateCapabilityMatrix
        scene={scene}
        config={config}
        saving={saving}
        onSaveCapability={onSaveCapability}
        onPatchConfig={onPatchConfig}
      />

      <AgentGateAdvancedRulesSection
        scene={scene}
        config={config}
        saving={saving}
        onPatchConfig={onPatchConfig}
      />

      <div className={pane.stackGroup}>
        <div className={pane.sectionLabelRow}>
          <h3 className={pane.sectionLabel}>
            {t('settings.agent_gate_notifications_title', '系统通知')}
          </h3>
          <HelpTooltip
            size={14}
            content={t(
              'settings.agent_gate_notifications_hint',
              '设备级偏好，不写入权限策略。通知仅显示非敏感摘要。'
            )}
          />
        </div>
        <section className={pane.cardSection}>
          <div className={`${pane.cardBody} ${styles.paddedBody}`}>
            <div className="settings-list-tile settings-list-tile-noclick">
              <div className="settings-list-tile-content">
                <span className="settings-list-tile-title">
                  {t('settings.agent_gate_notify_enabled', '系统通知')}
                </span>
              </div>
              <Switch
                checked={notificationPrefs.enabled}
                disabled={saving}
                aria-label={t('settings.agent_gate_notify_enabled', '系统通知')}
                onChange={(e) => void onUpdateNotificationPrefs({ enabled: e.target.checked })}
              />
            </div>
            <div className={pane.divider} />
            <div className="settings-list-tile settings-list-tile-noclick">
              <div className="settings-list-tile-content">
                <span className="settings-list-tile-title">
                  {t('settings.agent_gate_notify_sound', '通知声音')}
                </span>
              </div>
              <Switch
                checked={notificationPrefs.soundEnabled}
                disabled={saving || !notificationPrefs.enabled}
                aria-label={t('settings.agent_gate_notify_sound', '通知声音')}
                onChange={(e) => void onUpdateNotificationPrefs({ soundEnabled: e.target.checked })}
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
