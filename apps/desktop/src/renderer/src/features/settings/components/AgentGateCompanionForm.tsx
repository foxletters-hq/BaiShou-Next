import React from 'react'
import { useTranslation } from 'react-i18next'
import {
  resolveAgentToolActionLabel,
  type AgentGateAllowlistEntry,
  type AgentGateCapabilityEffect,
  type AgentGateCapabilityId,
  type AgentGateNotificationPrefs,
  type AgentToolScene,
  type BaishouAgentGateConfig
} from '@baishou/shared'
import { Button, HelpTooltip, Switch } from '@baishou/ui'
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
  onRemoveAllowlistEntry: (entry: AgentGateAllowlistEntry) => void | Promise<void>
  onUpdateNotificationPrefs: (patch: Partial<AgentGateNotificationPrefs>) => void | Promise<void>
}

export const AgentGateCompanionForm: React.FC<AgentGateCompanionFormProps> = ({
  scene,
  config,
  saving,
  notificationPrefs,
  onSaveCapability,
  onPatchConfig,
  onRemoveAllowlistEntry,
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

      <div className={pane.stackGroup}>
        <div className={pane.sectionLabelRow}>
          <h3 className={pane.sectionLabel}>
            {t('settings.agent_gate_allowlist_title', '始终允许列表')}
          </h3>
          <HelpTooltip
            size={14}
            content={
              scene === 'workspace'
                ? t(
                    'settings.workspace_gate_allowlist_hint',
                    '仅作用于当前工作区；不会影响伙伴或其他工作区。'
                  )
                : t('settings.agent_gate_allowlist_hint', '仅作用于伙伴会话；不会影响工作台。')
            }
          />
        </div>
        <section className={pane.cardSection}>
          <div className={`${pane.cardBody} ${styles.paddedBody}`}>
            {config.allowlist.length === 0 ? (
              <p className={styles.emptyHint}>
                {t(
                  'settings.agent_gate_allowlist_empty',
                  '暂无条目；在聊天中点「始终允许」后会出现在这里。'
                )}
              </p>
            ) : (
              config.allowlist.map((entry, index) => (
                <React.Fragment key={entry.id}>
                  {index > 0 ? <div className={pane.divider} /> : null}
                  <div className="settings-list-tile settings-list-tile-noclick">
                    <div className="settings-list-tile-content">
                      <span className="settings-list-tile-title">
                        {resolveAgentToolActionLabel(entry.action, t)}
                      </span>
                      <span className="settings-list-tile-subtitle">
                        {entry.pattern
                          ? t('settings.agent_gate_allowlist_pattern', '模式：{{pattern}}', {
                              pattern: entry.pattern
                            })
                          : t('settings.agent_gate_allowlist_whole_action', '整工具放行')}
                        {' · '}
                        {new Date(entry.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <Button
                      type="button"
                      disabled={saving}
                      onClick={() => void onRemoveAllowlistEntry(entry)}
                    >
                      {t('common.remove', '移除')}
                    </Button>
                  </div>
                </React.Fragment>
              ))
            )}
          </div>
        </section>
      </div>

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
