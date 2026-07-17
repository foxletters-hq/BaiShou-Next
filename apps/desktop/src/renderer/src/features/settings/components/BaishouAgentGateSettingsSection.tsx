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
import styles from './GeneralSettingsPane.module.css'

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
      <section className={styles.cardSection}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>
            {t('settings.agent_gate_title', '伙伴操作门控')}
          </h3>
        </div>
        <div className={styles.cardBody}>{t('common.loading', '加载中...')}</div>
      </section>
    )
  }

  if (!config) return null

  const exclusionList =
    config.exclusionList.length > 0 ? config.exclusionList : [...DEFAULT_AGENT_GATE_EXCLUSION_LIST]
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
      <section className={styles.cardSection}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>
            {t('settings.agent_gate_title', '伙伴操作门控')}
          </h3>
        </div>
        <div className={styles.cardBody}>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
            {t(
              'settings.agent_gate_desc',
              '控制伙伴执行写入、修改等敏感操作前是否需要你确认。'
            )}
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            <button
              type="button"
              disabled={saving}
              onClick={() => void updateTrustMode(AgentGateTrustMode.Manual)}
              style={chipStyle(config.trustMode === AgentGateTrustMode.Manual)}
            >
              {t('settings.agent_gate_manual', '逐项确认')}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void updateTrustMode(AgentGateTrustMode.FullTrust)}
              style={chipStyle(config.trustMode === AgentGateTrustMode.FullTrust)}
            >
              {t('settings.agent_gate_full_trust', '完全信任')}
            </button>
          </div>

          <label style={checkLabelStyle(saving)}>
            <input
              type="checkbox"
              disabled={saving}
              checked={config.hideDeniedTools !== false}
              onChange={(e) => void patchConfig({ hideDeniedTools: e.target.checked })}
              style={{ marginTop: 3 }}
            />
            <span>
              <span style={{ fontWeight: 600, fontSize: 13 }}>
                {t('settings.agent_gate_hide_denied', '隐藏被拒绝的工具')}
              </span>
              <span style={hintStyle}>
                {t(
                  'settings.agent_gate_hide_denied_hint',
                  '开启后，当前场景下被默认拒绝的工具不会出现在伙伴可选列表中。'
                )}
              </span>
            </span>
          </label>

          <label style={checkLabelStyle(saving)}>
            <input
              type="checkbox"
              disabled={saving}
              checked={config.forceAskExternalPath !== false}
              onChange={(e) => void patchConfig({ forceAskExternalPath: e.target.checked })}
              style={{ marginTop: 3 }}
            />
            <span>
              <span style={{ fontWeight: 600, fontSize: 13 }}>
                {t('settings.agent_gate_force_ask_external', '工作区外路径强制确认')}
              </span>
              <span style={hintStyle}>
                {t(
                  'settings.agent_gate_force_ask_external_hint',
                  '触及工作区外路径时始终征求确认，即使开启完全信任或已加入始终允许。'
                )}
              </span>
            </span>
          </label>

          <label style={{ display: 'block', marginTop: 14 }}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>
              {t('settings.agent_gate_repeat_threshold', '同参连打再确认阈值')}
            </span>
            <span style={hintStyle}>
              {t(
                'settings.agent_gate_repeat_threshold_hint',
                '相同指纹连续请求达到该次数时再次弹出确认；0 表示关闭。确认卡片会显示短指纹。'
              )}
            </span>
            <input
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
              style={{
                marginTop: 8,
                width: 96,
                padding: '6px 8px',
                borderRadius: 8,
                border: '1px solid var(--border-subtle, rgba(0,0,0,0.12))'
              }}
            />
          </label>
        </div>
      </section>

      <section className={styles.cardSection}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>
            {t('settings.agent_gate_exclusion_title', '始终需确认的操作')}
          </h3>
        </div>
        <div className={styles.cardBody}>
          <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--text-secondary)' }}>
            {t(
              'settings.agent_gate_exclusion_edit_hint',
              '下列操作无法「始终允许」；可增删自定义 action 名。'
            )}
          </p>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 6 }}>
            {exclusionList.map((action) => (
              <li key={action} style={rowStyle}>
                <code>{action}</code>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => removeExclusion(action)}
                  style={smallBtnStyle}
                >
                  {t('common.remove', '移除')}
                </button>
              </li>
            ))}
          </ul>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <input
              value={exclusionDraft}
              onChange={(e) => setExclusionDraft(e.target.value)}
              placeholder="e.g. workspace_run"
              disabled={saving}
              style={inputStyle}
            />
            <button type="button" disabled={saving} onClick={addExclusion} style={smallBtnStyle}>
              {t('common.add', '添加')}
            </button>
          </div>
        </div>
      </section>

      <section className={styles.cardSection}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>
            {t('settings.agent_gate_profile_title', '场景默认松紧')}
          </h3>
        </div>
        <div className={styles.cardBody}>
          <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--text-secondary)' }}>
            {t(
              'settings.agent_gate_profile_hint',
              '伙伴会话与工作区会话使用不同默认规则；下方可叠加你的自定义规则。'
            )}
          </p>
          <ProfileRulesReadonly
            title={t('settings.agent_gate_profile_companion', '伙伴会话')}
            rules={[...AGENT_GATE_PROFILE_DEFAULT_RULES[AgentGateProfileId.Companion]]}
          />
          <ProfileRulesReadonly
            title={t('settings.agent_gate_profile_workspace', '工作区会话')}
            rules={[...AGENT_GATE_PROFILE_DEFAULT_RULES[AgentGateProfileId.Workspace]]}
          />
          <div style={{ marginTop: 12, fontWeight: 600, fontSize: 13 }}>
            {t('settings.agent_gate_user_rules', '我的额外规则')}
          </div>
          {permissionRules.length === 0 ? (
            <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
              {t('settings.agent_gate_user_rules_empty', '暂无')}
            </p>
          ) : (
            <ul style={{ margin: '8px 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: 6 }}>
              {permissionRules.map((rule, index) => (
                <li key={`${rule.action}-${index}`} style={rowStyle}>
                  <span style={{ fontSize: 13 }}>
                    <code>{rule.action}</code>
                    {rule.pattern ? (
                      <span style={{ color: 'var(--text-secondary)' }}> · {rule.pattern}</span>
                    ) : null}
                    <span style={{ color: 'var(--text-secondary)' }}> → {rule.effect}</span>
                  </span>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => removePermissionRule(index)}
                    style={smallBtnStyle}
                  >
                    {t('common.remove', '移除')}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
            <input
              value={ruleAction}
              onChange={(e) => setRuleAction(e.target.value)}
              placeholder="action（支持 workspace_*）"
              disabled={saving}
              style={inputStyle}
            />
            <input
              value={rulePattern}
              onChange={(e) => setRulePattern(e.target.value)}
              placeholder="可选 pattern（路径或命令前缀）"
              disabled={saving}
              style={inputStyle}
            />
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select
                value={ruleEffect}
                disabled={saving}
                onChange={(e) => setRuleEffect(e.target.value as AgentGateEffect)}
                style={{ ...inputStyle, width: 140 }}
              >
                <option value={AgentGateEffect.Allow}>Allow</option>
                <option value={AgentGateEffect.Ask}>Ask</option>
                <option value={AgentGateEffect.Deny}>Deny</option>
              </select>
              <button type="button" disabled={saving} onClick={addPermissionRule} style={smallBtnStyle}>
                {t('common.add', '添加')}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.cardSection}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>
            {t('settings.agent_gate_allowlist_title', '始终允许列表')}
          </h3>
        </div>
        <div className={styles.cardBody}>
          {config.allowlist.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
              {t(
                'settings.agent_gate_allowlist_empty',
                '暂无条目；在聊天中点「始终允许」后会出现在这里。'
              )}
            </p>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 8 }}>
              {config.allowlist.map((entry) => (
                <li key={entry.id} style={rowStyle}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{entry.action}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {entry.pattern
                        ? t('settings.agent_gate_allowlist_pattern', '模式：{{pattern}}', {
                            pattern: entry.pattern
                          })
                        : t('settings.agent_gate_allowlist_whole_action', '整工具放行')}
                      {' · '}
                      {new Date(entry.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void removeAllowlistEntry(entry)}
                    style={smallBtnStyle}
                  >
                    {t('common.remove', '移除')}
                  </button>
                </li>
              ))}
            </ul>
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
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{title}</div>
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--text-secondary)' }}>
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

function chipStyle(active: boolean): React.CSSProperties {
  return {
    padding: '8px 14px',
    borderRadius: 10,
    border: active
      ? '1px solid var(--color-primary, #5ba8f5)'
      : '1px solid var(--border-subtle, rgba(0,0,0,0.1))',
    background: active
      ? 'color-mix(in srgb, var(--color-primary, #5ba8f5) 12%, transparent)'
      : 'transparent',
    cursor: 'pointer'
  }
}

const hintStyle: React.CSSProperties = {
  display: 'block',
  marginTop: 2,
  fontSize: 12,
  color: 'var(--text-secondary)',
  lineHeight: 1.5
}

function checkLabelStyle(saving: boolean): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 12,
    cursor: saving ? 'default' : 'pointer'
  }
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  padding: '8px 10px',
  borderRadius: 10,
  border: '1px solid var(--border-subtle, rgba(0,0,0,0.08))'
}

const smallBtnStyle: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: 8,
  border: '1px solid var(--border-subtle, rgba(0,0,0,0.1))',
  background: 'transparent',
  cursor: 'pointer',
  flexShrink: 0
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: '6px 8px',
  borderRadius: 8,
  border: '1px solid var(--border-subtle, rgba(0,0,0,0.12))'
}
