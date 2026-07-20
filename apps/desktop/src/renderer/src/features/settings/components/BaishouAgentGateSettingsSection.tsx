import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AGENT_GATE_PROFILE_DEFAULT_RULES,
  AgentGateEffect,
  AgentGateProfileId,
  AgentGateTrustMode,
  DEFAULT_AGENT_GATE_EXCLUSION_LIST,
  DEFAULT_AGENT_GATE_REPEAT_ASSERT_ASK_THRESHOLD,
  type AgentGateAllowlistEntry,
  type AgentGatePermissionRule,
  type BaishouAgentGateConfig
} from '@baishou/shared'
import '@baishou/ui/desktop/shared/SettingsListTile.css'
import pane from './GeneralSettingsPane.module.css'
import styles from './AgentGateSettings.module.css'

export const BaishouAgentGateSettingsSection: React.FC = () => {
  const { t } = useTranslation()
  const [config, setConfig] = useState<BaishouAgentGateConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [exclusionDraft, setExclusionDraft] = useState('')
  const [ruleAction, setRuleAction] = useState('')
  const [rulePattern, setRulePattern] = useState('')
  const [ruleEffect, setRuleEffect] = useState<AgentGateEffect>(AgentGateEffect.Ask)

  const loadConfig = useCallback(async () => {
    setLoading(true)
    try {
      const next = await window.api.settings.getBaishouAgentGateConfig()
      setConfig(next)
    } catch (error) {
      console.error('[BaishouAgentGateSettings] load failed:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadConfig()
    const unsubscribe = window.api.agentGate?.onAllowlistChanged?.((allowlist) => {
      setConfig((prev) => (prev ? { ...prev, allowlist } : prev))
    })
    return () => unsubscribe?.()
  }, [loadConfig])

  const updateTrustMode = async (trustMode: AgentGateTrustMode) => {
    if (!config) return
    setSaving(true)
    try {
      const next = await window.api.agentGate.setTrustMode(trustMode)
      setConfig(next)
    } catch (error) {
      console.error('[BaishouAgentGateSettings] set trust mode failed:', error)
    } finally {
      setSaving(false)
    }
  }

  const removeAllowlistEntry = async (entry: AgentGateAllowlistEntry) => {
    setSaving(true)
    try {
      await window.api.agentGate.removeAllowlistEntry(entry.id)
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
      const next = await window.api.settings.setBaishouAgentGateConfig({
        ...config,
        ...patch
      })
      setConfig(next)
    } catch (error) {
      console.error('[BaishouAgentGateSettings] patch config failed:', error)
    } finally {
      setSaving(false)
    }
  }

  if (loading && !config) {
    return (
      <section className={pane.cardSection}>
        <div className={pane.cardHeader}>
          <h3 className={pane.cardTitle}>{t('settings.agent_gate_title', '伙伴操作门控')}</h3>
        </div>
        <div className={`${pane.cardBody} ${styles.paddedBody}`}>
          <p className={styles.emptyHint}>{t('common.loading', '加载中...')}</p>
        </div>
      </section>
    )
  }

  if (!config) return null

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
    void patchConfig({ exclusionList: [...exclusionList, action] }).then(() =>
      setExclusionDraft('')
    )
  }

  const removeExclusion = (action: string) => {
    void patchConfig({ exclusionList: exclusionList.filter((item) => item !== action) })
  }

  const addPermissionRule = () => {
    const action = ruleAction.trim()
    if (!action) return
    const next: AgentGatePermissionRule = {
      action,
      effect: ruleEffect,
      ...(rulePattern.trim() ? { pattern: rulePattern.trim() } : {})
    }
    void patchConfig({ permissionRules: [...permissionRules, next] }).then(() => {
      setRuleAction('')
      setRulePattern('')
      setRuleEffect(AgentGateEffect.Ask)
    })
  }

  const removePermissionRule = (index: number) => {
    void patchConfig({
      permissionRules: permissionRules.filter((_, i) => i !== index)
    })
  }

  return (
    <>
      <section className={pane.cardSection}>
        <div className={pane.cardHeader}>
          <h3 className={pane.cardTitle}>{t('settings.agent_gate_title', '伙伴操作门控')}</h3>
          <p className={styles.cardDesc}>
            {t('settings.agent_gate_desc', '控制伙伴执行写入、修改等敏感操作前是否需要你确认。')}
          </p>
        </div>
        <div className={`${pane.cardBody} ${styles.paddedBody}`}>
          <div className={styles.segmented} role="group">
            <button
              type="button"
              disabled={saving}
              className={`${styles.segmentBtn} ${
                config.trustMode === AgentGateTrustMode.Manual ? styles.segmentBtnActive : ''
              }`}
              onClick={() => void updateTrustMode(AgentGateTrustMode.Manual)}
            >
              {t('settings.agent_gate_manual', '逐项确认')}
            </button>
            <button
              type="button"
              disabled={saving}
              className={`${styles.segmentBtn} ${
                config.trustMode === AgentGateTrustMode.FullTrust ? styles.segmentBtnActive : ''
              }`}
              onClick={() => void updateTrustMode(AgentGateTrustMode.FullTrust)}
            >
              {t('settings.agent_gate_full_trust', '完全信任')}
            </button>
          </div>

          <div className="settings-list-tile settings-list-tile-noclick">
            <div className="settings-list-tile-content">
              <span className="settings-list-tile-title">
                {t('settings.agent_gate_hide_denied', '隐藏被拒绝的工具')}
              </span>
              <span className="settings-list-tile-subtitle">
                {t(
                  'settings.agent_gate_hide_denied_hint',
                  '开启后，当前场景下被默认拒绝的工具不会出现在伙伴可选列表中。'
                )}
              </span>
            </div>
            <label className="settings-switch-label">
              <input
                type="checkbox"
                disabled={saving}
                checked={config.hideDeniedTools !== false}
                onChange={(e) => void patchConfig({ hideDeniedTools: e.target.checked })}
              />
              <span className="settings-switch-slider" />
            </label>
          </div>
          <div className={pane.divider} />

          <div className="settings-list-tile settings-list-tile-noclick">
            <div className="settings-list-tile-content">
              <span className="settings-list-tile-title">
                {t('settings.agent_gate_force_ask_external', '工作区外路径强制确认')}
              </span>
              <span className="settings-list-tile-subtitle">
                {t(
                  'settings.agent_gate_force_ask_external_hint',
                  '触及工作区外路径时始终征求确认，即使开启完全信任或已加入始终允许。'
                )}
              </span>
            </div>
            <label className="settings-switch-label">
              <input
                type="checkbox"
                disabled={saving}
                checked={config.forceAskExternalPath !== false}
                onChange={(e) => void patchConfig({ forceAskExternalPath: e.target.checked })}
              />
              <span className="settings-switch-slider" />
            </label>
          </div>
          <div className={pane.divider} />

          <div className="settings-list-tile settings-list-tile-noclick">
            <div className="settings-list-tile-content">
              <span className="settings-list-tile-title">
                {t('settings.agent_gate_repeat_threshold', '同参连打再确认阈值')}
              </span>
              <span className="settings-list-tile-subtitle">
                {t(
                  'settings.agent_gate_repeat_threshold_hint',
                  '相同指纹连续请求达到该次数时再次弹出确认；0 表示关闭。确认卡片会显示短指纹。'
                )}
              </span>
            </div>
            <input
              className="settings-number-input"
              type="number"
              min={0}
              max={20}
              disabled={saving}
              value={threshold}
              onChange={(e) => {
                const n = Number(e.target.value)
                if (!Number.isFinite(n)) return
                void patchConfig({
                  repeatAssertAskThreshold: Math.max(0, Math.min(20, Math.floor(n)))
                })
              }}
            />
          </div>
        </div>
      </section>

      <section className={pane.cardSection}>
        <div className={pane.cardHeader}>
          <h3 className={pane.cardTitle}>
            {t('settings.agent_gate_exclusion_title', '始终需确认的操作')}
          </h3>
          <p className={styles.cardDesc}>
            {t(
              'settings.agent_gate_exclusion_edit_hint',
              '下列操作无法「始终允许」；可增删自定义 action 名。'
            )}
          </p>
        </div>
        <div className={`${pane.cardBody} ${styles.paddedBody}`}>
          {exclusionList.map((action, index) => (
            <React.Fragment key={action}>
              {index > 0 ? <div className={pane.divider} /> : null}
              <div className="settings-list-tile settings-list-tile-noclick">
                <div className="settings-list-tile-content">
                  <span className="settings-list-tile-title settings-monospace">{action}</span>
                </div>
                <button
                  type="button"
                  className="settings-text-btn"
                  disabled={saving}
                  onClick={() => removeExclusion(action)}
                >
                  {t('common.remove', '移除')}
                </button>
              </div>
            </React.Fragment>
          ))}
          <div className={styles.formRow}>
            <input
              className={styles.textInput}
              value={exclusionDraft}
              onChange={(e) => setExclusionDraft(e.target.value)}
              placeholder="e.g. workspace_run"
              disabled={saving}
            />
            <button
              type="button"
              className="settings-text-btn"
              disabled={saving}
              onClick={addExclusion}
            >
              {t('common.add', '添加')}
            </button>
          </div>
        </div>
      </section>

      <section className={pane.cardSection}>
        <div className={pane.cardHeader}>
          <h3 className={pane.cardTitle}>
            {t('settings.agent_gate_profile_title', '场景默认松紧')}
          </h3>
          <p className={styles.cardDesc}>
            {t(
              'settings.agent_gate_profile_hint',
              '伙伴会话与工作区会话使用不同默认规则；下方可叠加你的自定义规则。'
            )}
          </p>
        </div>
        <div className={`${pane.cardBody} ${styles.paddedBody}`}>
          <ProfileRulesReadonly
            title={t('settings.agent_gate_profile_companion', '伙伴会话')}
            rules={[...AGENT_GATE_PROFILE_DEFAULT_RULES[AgentGateProfileId.Companion]]}
          />
          <ProfileRulesReadonly
            title={t('settings.agent_gate_profile_workspace', '工作区会话')}
            rules={[...AGENT_GATE_PROFILE_DEFAULT_RULES[AgentGateProfileId.Workspace]]}
          />
          <div className={styles.sectionLabel}>
            {t('settings.agent_gate_user_rules', '我的额外规则')}
          </div>
          {permissionRules.length === 0 ? (
            <p className={styles.emptyHint}>{t('settings.agent_gate_user_rules_empty', '暂无')}</p>
          ) : (
            permissionRules.map((rule, index) => (
              <React.Fragment key={`${rule.action}-${index}`}>
                {index > 0 ? <div className={pane.divider} /> : null}
                <div className="settings-list-tile settings-list-tile-noclick">
                  <div className="settings-list-tile-content">
                    <span className="settings-list-tile-title">
                      <code>{rule.action}</code>
                      {rule.pattern ? ` · ${rule.pattern}` : ''} → {rule.effect}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="settings-text-btn"
                    disabled={saving}
                    onClick={() => removePermissionRule(index)}
                  >
                    {t('common.remove', '移除')}
                  </button>
                </div>
              </React.Fragment>
            ))
          )}
          <div className={styles.formRow}>
            <input
              className={styles.textInput}
              value={ruleAction}
              onChange={(e) => setRuleAction(e.target.value)}
              placeholder="action（支持 workspace_*）"
              disabled={saving}
            />
            <input
              className={styles.textInput}
              value={rulePattern}
              onChange={(e) => setRulePattern(e.target.value)}
              placeholder="可选 pattern"
              disabled={saving}
            />
            <select
              className={styles.selectInput}
              value={ruleEffect}
              disabled={saving}
              onChange={(e) => setRuleEffect(e.target.value as AgentGateEffect)}
            >
              <option value={AgentGateEffect.Allow}>Allow</option>
              <option value={AgentGateEffect.Ask}>Ask</option>
              <option value={AgentGateEffect.Deny}>Deny</option>
            </select>
            <button
              type="button"
              className="settings-text-btn"
              disabled={saving}
              onClick={addPermissionRule}
            >
              {t('common.add', '添加')}
            </button>
          </div>
        </div>
      </section>

      <section className={pane.cardSection}>
        <div className={pane.cardHeader}>
          <h3 className={pane.cardTitle}>
            {t('settings.agent_gate_allowlist_title', '始终允许列表')}
          </h3>
        </div>
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
                    <span className="settings-list-tile-title">{entry.action}</span>
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
                  <button
                    type="button"
                    className="settings-text-btn"
                    disabled={saving}
                    onClick={() => void removeAllowlistEntry(entry)}
                  >
                    {t('common.remove', '移除')}
                  </button>
                </div>
              </React.Fragment>
            ))
          )}
        </div>
      </section>
    </>
  )
}

function ProfileRulesReadonly({
  title,
  rules
}: {
  title: string
  rules: AgentGatePermissionRule[]
}) {
  return (
    <div className={styles.profileBlock}>
      <div className={styles.profileTitle}>{title}</div>
      <ul className={styles.profileList}>
        {rules.map((rule) => (
          <li key={`${rule.action}-${rule.effect}-${rule.pattern ?? ''}`}>
            <code>{rule.action}</code>
            {rule.pattern ? ` (${rule.pattern})` : ''} → {rule.effect}
          </li>
        ))}
      </ul>
    </div>
  )
}
