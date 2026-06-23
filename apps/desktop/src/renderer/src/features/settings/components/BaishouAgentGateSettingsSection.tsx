import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AgentGateTrustMode,
  DEFAULT_AGENT_GATE_EXCLUSION_LIST,
  type AgentGateAllowlistEntry,
  type BaishouAgentGateConfig
} from '@baishou/shared'
import styles from './GeneralSettingsPane.module.css'

export const BaishouAgentGateSettingsSection: React.FC = () => {
  const { t } = useTranslation()
  const [config, setConfig] = useState<BaishouAgentGateConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

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
              style={{
                padding: '8px 14px',
                borderRadius: 10,
                border:
                  config.trustMode === AgentGateTrustMode.Manual
                    ? '1px solid var(--color-primary, #5ba8f5)'
                    : '1px solid var(--border-subtle, rgba(0,0,0,0.1))',
                background:
                  config.trustMode === AgentGateTrustMode.Manual
                    ? 'color-mix(in srgb, var(--color-primary, #5ba8f5) 12%, transparent)'
                    : 'transparent',
                cursor: 'pointer'
              }}
            >
              {t('settings.agent_gate_manual', '逐项确认')}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void updateTrustMode(AgentGateTrustMode.FullTrust)}
              style={{
                padding: '8px 14px',
                borderRadius: 10,
                border:
                  config.trustMode === AgentGateTrustMode.FullTrust
                    ? '1px solid var(--color-primary, #5ba8f5)'
                    : '1px solid var(--border-subtle, rgba(0,0,0,0.1))',
                background:
                  config.trustMode === AgentGateTrustMode.FullTrust
                    ? 'color-mix(in srgb, var(--color-primary, #5ba8f5) 12%, transparent)'
                    : 'transparent',
                cursor: 'pointer'
              }}
            >
              {t('settings.agent_gate_full_trust', '完全信任')}
            </button>
          </div>
        </div>
      </section>

      <section className={styles.cardSection}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>
            {t('settings.agent_gate_exclusion_title', '始终需确认的操作')}
          </h3>
        </div>
        <div className={styles.cardBody}>
          <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
            {exclusionList.map((action) => (
              <li key={action}>
                <code>{action}</code>
              </li>
            ))}
          </ul>
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
              {t('settings.agent_gate_allowlist_empty', '暂无条目；在聊天中点「始终允许」后会出现在这里。')}
            </p>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 8 }}>
              {config.allowlist.map((entry) => (
                <li
                  key={entry.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: '1px solid var(--border-subtle, rgba(0,0,0,0.08))'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>{entry.action}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {new Date(entry.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void removeAllowlistEntry(entry)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--border-subtle, rgba(0,0,0,0.1))',
                      background: 'transparent',
                      cursor: 'pointer'
                    }}
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
