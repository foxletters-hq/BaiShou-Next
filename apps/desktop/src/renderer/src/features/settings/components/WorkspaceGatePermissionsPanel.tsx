import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  DEFAULT_WORKSPACE_COMMAND_BLACKLIST,
  resolveWorkspaceSecurityMode,
  type AgentGateAllowlistEntry,
  type AgentGateNotificationPrefs,
  type AgentWorkspaceSecurityMode,
  type BaishouAgentGateConfig
} from '@baishou/shared'
import { HelpTooltip } from '@baishou/ui'
import { ArrowLeft, Check, ChevronRight } from 'lucide-react'
import '@baishou/ui/desktop/shared/SettingsListTile.css'
import pane from './GeneralSettingsPane.module.css'
import styles from './AgentGateSettings.module.css'

export type WorkspaceGatePermissionsView = 'home' | 'blacklist' | 'allowlist'

export interface WorkspaceGatePermissionsPanelProps {
  config: BaishouAgentGateConfig
  saving: boolean
  notificationPrefs: AgentGateNotificationPrefs
  onSaveSecurityMode: (mode: AgentWorkspaceSecurityMode) => void | Promise<void>
  onRemoveAllowlistEntry: (entry: AgentGateAllowlistEntry) => void | Promise<void>
  onUpdateNotificationPrefs: (patch: Partial<AgentGateNotificationPrefs>) => void | Promise<void>
  onSubpageActiveChange?: (active: boolean) => void
}

export const WorkspaceGatePermissionsPanel: React.FC<WorkspaceGatePermissionsPanelProps> = ({
  config,
  saving,
  notificationPrefs,
  onSaveSecurityMode,
  onRemoveAllowlistEntry,
  onUpdateNotificationPrefs,
  onSubpageActiveChange
}) => {
  const { t } = useTranslation()
  const [view, setView] = useState<WorkspaceGatePermissionsView>('home')

  const navigate = (next: WorkspaceGatePermissionsView) => {
    setView(next)
    // 同步通知父级，避免 Esc/顶栏 tab 与 view 差一帧
    onSubpageActiveChange?.(next !== 'home')
  }

  useEffect(() => {
    return () => onSubpageActiveChange?.(false)
  }, [onSubpageActiveChange])

  useEffect(() => {
    if (view === 'home') return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      setView('home')
      onSubpageActiveChange?.(false)
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [view, onSubpageActiveChange])

  const securityMode = resolveWorkspaceSecurityMode(config)
  const commandBlacklist =
    config.commandBlacklist && config.commandBlacklist.length > 0
      ? config.commandBlacklist
      : [...DEFAULT_WORKSPACE_COMMAND_BLACKLIST]
  const commandAllowlist = config.allowlist.filter((entry) => entry.action === 'workspace_run')

  const goHome = () => navigate('home')

  if (view === 'blacklist') {
    return (
      <div className={pane.stack}>
        <div className={pane.stackGroup}>
          <button type="button" className={styles.subpageBack} onClick={goHome}>
            <ArrowLeft size={16} aria-hidden />
            <span>{t('settings.agent_gate_command_blacklist_title', '命令黑名单')}</span>
          </button>
          <p className={styles.emptyHint}>
            {t(
              'settings.agent_gate_blacklist_page_hint',
              '全局生效。命中的命令强制询问，且不可「始终允许」。'
            )}
          </p>
          <section className={pane.cardSection}>
            <div className={`${pane.cardBody} ${styles.paddedBody}`}>
              {commandBlacklist.length === 0 ? (
                <p className={styles.emptyHint}>
                  {t('settings.agent_gate_blacklist_empty', '暂无黑名单命令')}
                </p>
              ) : (
                commandBlacklist.map((pattern, index) => (
                  <React.Fragment key={pattern}>
                    {index > 0 ? <div className={pane.divider} /> : null}
                    <div className="settings-list-tile settings-list-tile-noclick">
                      <div className="settings-list-tile-content">
                        <span className="settings-list-tile-title settings-monospace">
                          {pattern}
                        </span>
                      </div>
                    </div>
                  </React.Fragment>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    )
  }

  if (view === 'allowlist') {
    return (
      <div className={pane.stack}>
        <div className={pane.stackGroup}>
          <button type="button" className={styles.subpageBack} onClick={goHome}>
            <ArrowLeft size={16} aria-hidden />
            <span>{t('settings.agent_gate_command_allowlist_title', '始终允许（白名单）')}</span>
          </button>
          <p className={styles.emptyHint}>
            {t(
              'settings.agent_gate_allowlist_page_hint',
              '供白名单与自动审核使用。在审批中点「始终允许」后会出现在这里。'
            )}
          </p>
          <section className={pane.cardSection}>
            <div className={`${pane.cardBody} ${styles.paddedBody}`}>
              {commandAllowlist.length === 0 ? (
                <p className={styles.emptyHint}>
                  {t(
                    'settings.agent_gate_command_allowlist_empty',
                    '暂无条目；在聊天中点「始终允许」后会出现在这里。'
                  )}
                </p>
              ) : (
                commandAllowlist.map((entry, index) => (
                  <React.Fragment key={entry.id}>
                    {index > 0 ? <div className={pane.divider} /> : null}
                    <div className="settings-list-tile settings-list-tile-noclick">
                      <div className="settings-list-tile-content">
                        <span className="settings-list-tile-title settings-monospace">
                          {entry.pattern ?? entry.action}
                        </span>
                        <span className="settings-list-tile-subtitle">
                          {new Date(entry.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="settings-text-btn"
                        disabled={saving}
                        onClick={() => void onRemoveAllowlistEntry(entry)}
                      >
                        {t('common.remove', '移除')}
                      </button>
                    </div>
                  </React.Fragment>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    )
  }

  const modes = [
    {
      value: 'full_access' as const,
      title: t('settings.agent_security_full_access', '完全访问'),
      hint: t('settings.agent_security_full_access_hint', '尽量自动执行；黑名单命令仍会询问')
    },
    {
      value: 'auto_review' as const,
      title: t('settings.agent_security_auto_review', '自动审核'),
      hint: t('settings.agent_security_auto_review_hint', '编辑直通；命令经模型审核')
    },
    {
      value: 'allow_list' as const,
      title: t('settings.agent_security_allow_list', '白名单'),
      hint: t('settings.agent_security_allow_list_hint', '默认询问；仅始终允许的命令自动放行')
    }
  ] as const

  return (
    <div className={pane.stack}>
      <div className={pane.stackGroup}>
        <div className={pane.sectionLabelRow}>
          <h3 className={pane.sectionLabel}>
            {t('settings.agent_security_mode', 'Agent 安全模式')}
          </h3>
          <HelpTooltip
            size={14}
            content={t(
              'settings.workspace_gate_desc',
              '全局统一约束工作台 Agent 的工具调用；你本人在工作台中的编辑、删除与 Git 操作不受影响。'
            )}
          />
        </div>
        <section className={pane.cardSection}>
          <div className={`${pane.cardBody} ${styles.paddedBody}`}>
            <p className={styles.emptyHint}>
              {t(
                'settings.agent_security_mode_hint',
                '全局统一，对所有工作区生效。危险命令默认需确认。'
              )}
            </p>
            {modes.map((mode) => (
              <button
                key={mode.value}
                type="button"
                className="settings-list-tile"
                disabled={saving}
                aria-pressed={securityMode === mode.value}
                onClick={() => void onSaveSecurityMode(mode.value)}
                style={
                  securityMode === mode.value
                    ? { background: 'var(--bg-surface-high)' }
                    : undefined
                }
              >
                <div className="settings-list-tile-content">
                  <span className="settings-list-tile-title">{mode.title}</span>
                  <span className="settings-list-tile-subtitle">{mode.hint}</span>
                </div>
                {securityMode === mode.value ? (
                  <Check size={16} aria-hidden style={{ flexShrink: 0, opacity: 0.85 }} />
                ) : null}
              </button>
            ))}

            <div className={pane.divider} />

            <button
              type="button"
              className="settings-list-tile"
              onClick={() => navigate('blacklist')}
            >
              <div className="settings-list-tile-content">
                <span className="settings-list-tile-title">
                  {t('settings.agent_gate_command_blacklist_title', '命令黑名单')}
                </span>
                <span className="settings-list-tile-subtitle">
                  {t('settings.agent_gate_list_count', '{{count}} 条', {
                    count: commandBlacklist.length
                  })}
                </span>
              </div>
              <ChevronRight size={16} aria-hidden style={{ flexShrink: 0, opacity: 0.55 }} />
            </button>

            <div className={pane.divider} />

            <button
              type="button"
              className="settings-list-tile"
              onClick={() => navigate('allowlist')}
            >
              <div className="settings-list-tile-content">
                <span className="settings-list-tile-title">
                  {t('settings.agent_gate_command_allowlist_title', '始终允许（白名单）')}
                </span>
                <span className="settings-list-tile-subtitle">
                  {t('settings.agent_gate_list_count', '{{count}} 条', {
                    count: commandAllowlist.length
                  })}
                </span>
              </div>
              <ChevronRight size={16} aria-hidden style={{ flexShrink: 0, opacity: 0.55 }} />
            </button>
          </div>
        </section>
      </div>

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
              <label className={`settings-switch-label ${styles.compactSwitch}`}>
                <input
                  type="checkbox"
                  checked={notificationPrefs.enabled}
                  disabled={saving}
                  onChange={(e) => void onUpdateNotificationPrefs({ enabled: e.target.checked })}
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
              <label className={`settings-switch-label ${styles.compactSwitch}`}>
                <input
                  type="checkbox"
                  checked={notificationPrefs.soundEnabled}
                  disabled={saving || !notificationPrefs.enabled}
                  onChange={(e) =>
                    void onUpdateNotificationPrefs({ soundEnabled: e.target.checked })
                  }
                />
                <span className="settings-switch-slider" />
              </label>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
