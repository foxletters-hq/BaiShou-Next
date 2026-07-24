import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AGENT_GATE_PROFILE_DEFAULT_RULES,
  AgentGateEffect,
  AgentGateProfileId,
  applyCapabilityStateToConfig,
  capabilityStateFromConfig,
  DEFAULT_AGENT_GATE_EXCLUSION_LIST,
  DEFAULT_AGENT_GATE_REPEAT_ASSERT_ASK_THRESHOLD,
  DEFAULT_WORKSPACE_AGENT_GATE_EXCLUSION_LIST,
  getGateCapabilitiesForScene,
  type AgentGateAllowlistEntry,
  type AgentGateCapabilityEffect,
  type AgentGateCapabilityId,
  type AgentGateConfigScope,
  type AgentGateNotificationPrefs,
  type AgentGatePermissionRule,
  type AgentToolScene,
  type BaishouAgentGateConfig,
  DEFAULT_AGENT_GATE_NOTIFICATION_PREFS
} from '@baishou/shared'
import { HelpTooltip, SegmentedControl } from '@baishou/ui'
import '@baishou/ui/desktop/shared/SettingsListTile.css'
import pane from './GeneralSettingsPane.module.css'
import styles from './AgentGateSettings.module.css'

export interface BaishouAgentGateSettingsSectionProps {
  scene?: AgentToolScene
  scope?: AgentGateConfigScope
}

function scopesMatch(
  a?: AgentGateConfigScope,
  b?: AgentGateConfigScope
): boolean {
  if (!a && !b) return true
  if (!a || !b) return false
  if (a.kind !== b.kind) return false
  if (a.kind === 'workspace' && b.kind === 'workspace') {
    return a.workspaceId === b.workspaceId
  }
  return true
}

const CAPABILITY_TITLE_KEYS: Record<AgentGateCapabilityId, [string, string]> = {
  browse: ['settings.agent_gate_cap_browse', '读取'],
  edit: ['settings.agent_gate_cap_edit', '编辑'],
  delete: ['settings.agent_gate_cap_delete', '删除'],
  command: ['settings.agent_gate_cap_command', '运行命令'],
  external: ['settings.agent_gate_cap_external', '区外路径'],
  diary_write: ['settings.agent_gate_cap_diary_write', '写入日记'],
  diary_delete: ['settings.agent_gate_cap_diary_delete', '删除日记'],
  memory_store: ['settings.agent_gate_cap_memory_store', '写入记忆'],
  memory_delete: ['settings.agent_gate_cap_memory_delete', '删除记忆']
}

const CAPABILITY_HINT_KEYS: Record<AgentGateCapabilityId, [string, string]> = {
  browse: ['settings.agent_gate_cap_browse_hint', '列出与读取工作区内文件'],
  edit: ['settings.agent_gate_cap_edit_hint', '写入、补丁与重命名'],
  delete: ['settings.agent_gate_cap_delete_hint', '删除始终需要确认，不可改为允许或拒绝'],
  command: [
    'settings.agent_gate_cap_command_hint',
    '在主机执行命令；不可整项允许，仅可记住安全前缀'
  ],
  external: [
    'settings.agent_gate_cap_external_hint',
    '触及工作区外路径时的默认策略；可添加可信目录'
  ],
  diary_write: ['settings.agent_gate_cap_diary_write_hint', '创建或修改日记'],
  diary_delete: ['settings.agent_gate_cap_diary_delete_hint', '删除日记始终需要确认'],
  memory_store: ['settings.agent_gate_cap_memory_store_hint', '写入长期记忆'],
  memory_delete: ['settings.agent_gate_cap_memory_delete_hint', '删除记忆始终需要确认']
}

export const BaishouAgentGateSettingsSection: React.FC<BaishouAgentGateSettingsSectionProps> = ({
  scene = 'companion',
  scope = { kind: 'companion' }
}) => {
  const { t } = useTranslation()
  const [config, setConfig] = useState<BaishouAgentGateConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [notificationPrefs, setNotificationPrefs] = useState<AgentGateNotificationPrefs>(
    DEFAULT_AGENT_GATE_NOTIFICATION_PREFS
  )
  const [saving, setSaving] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [exclusionDraft, setExclusionDraft] = useState('')
  const [ruleAction, setRuleAction] = useState('')
  const [rulePattern, setRulePattern] = useState('')
  const [ruleEffect, setRuleEffect] = useState<AgentGateEffect>(AgentGateEffect.Ask)
  const [trustedDirDraft, setTrustedDirDraft] = useState('')

  const capabilities = useMemo(() => getGateCapabilitiesForScene(scene), [scene])

  const loadConfig = useCallback(async () => {
    setLoading(true)
    try {
      const next = await window.api.settings.getBaishouAgentGateConfig(scope)
      setConfig(next)
    } catch (error) {
      console.error('[BaishouAgentGateSettings] load failed:', error)
      setConfig(null)
    } finally {
      setLoading(false)
    }
  }, [scope])

  useEffect(() => {
    void loadConfig()
    void window.api.agentGate?.getNotificationPrefs?.().then((prefs) => {
      if (prefs) setNotificationPrefs(prefs)
    })
    const unsubscribe = window.api.agentGate?.onAllowlistChanged?.((allowlist, eventScope) => {
      const effectiveScope = eventScope ?? { kind: 'companion' as const }
      if (!scopesMatch(effectiveScope, scope)) return
      setConfig((prev) => (prev ? { ...prev, allowlist } : prev))
    })
    return () => unsubscribe?.()
  }, [loadConfig, scope])

  const updateNotificationPrefs = async (patch: Partial<AgentGateNotificationPrefs>) => {
    try {
      const next = await window.api.agentGate.setNotificationPrefs(patch)
      setNotificationPrefs(next)
    } catch (error) {
      console.error('[BaishouAgentGateSettings] notification prefs failed:', error)
    }
  }

  const removeAllowlistEntry = async (entry: AgentGateAllowlistEntry) => {
    setSaving(true)
    try {
      await window.api.agentGate.removeAllowlistEntry(entry.id, scope)
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
      const next = await window.api.settings.setBaishouAgentGateConfig(
        {
          ...config,
          ...patch
        },
        scope
      )
      setConfig(next)
    } catch (error) {
      console.error('[BaishouAgentGateSettings] patch config failed:', error)
    } finally {
      setSaving(false)
    }
  }

  const saveCapabilityState = async (
    effects: Partial<Record<AgentGateCapabilityId, AgentGateCapabilityEffect>>,
    trustedExternalDirs?: string[]
  ) => {
    if (!config) return
    const prevConfig = config
    const current = capabilityStateFromConfig(config, scene)
    const nextState = {
      effects: { ...current.effects, ...effects } as Record<
        AgentGateCapabilityId,
        AgentGateCapabilityEffect
      >,
      trustedExternalDirs: trustedExternalDirs ?? current.trustedExternalDirs
    }
    const nextConfig = applyCapabilityStateToConfig(config, scene, nextState)
    // 先本地更新，滑块立刻滑动；失败再回滚
    setConfig(nextConfig)
    setSaving(true)
    try {
      const saved = await window.api.settings.setBaishouAgentGateConfig(nextConfig, scope)
      setConfig(saved)
    } catch (error) {
      console.error('[BaishouAgentGateSettings] save capability failed:', error)
      setConfig(prevConfig)
    } finally {
      setSaving(false)
    }
  }

  if (loading && !config) {
    return (
      <div className={pane.stack}>
        <div className={pane.stackGroup}>
          <div className={pane.sectionLabelRow}>
            <h3 className={pane.sectionLabel}>
              {scene === 'workspace'
                ? t('settings.agent_gate_matrix_title', '能力权限')
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

  const capabilityState = capabilityStateFromConfig(config, scene)
  const defaultExclusion =
    scene === 'workspace'
      ? [...DEFAULT_WORKSPACE_AGENT_GATE_EXCLUSION_LIST]
      : [...DEFAULT_AGENT_GATE_EXCLUSION_LIST]
  const exclusionList = config.exclusionList ?? defaultExclusion
  const threshold =
    config.repeatAssertAskThreshold ?? DEFAULT_AGENT_GATE_REPEAT_ASSERT_ASK_THRESHOLD
  const permissionRules = config.permissionRules ?? []
  const profileId =
    scene === 'workspace' ? AgentGateProfileId.Workspace : AgentGateProfileId.Companion
  const commandAllowlist = config.allowlist.filter((entry) => entry.action === 'workspace_run')

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

  const addTrustedDir = () => {
    const dir = trustedDirDraft.trim().replace(/\\/g, '/')
    if (!dir || dir === '*' || dir === '**' || dir === '**/*') return
    if (capabilityState.trustedExternalDirs.includes(dir)) {
      setTrustedDirDraft('')
      return
    }
    void saveCapabilityState({}, [...capabilityState.trustedExternalDirs, dir]).then(() =>
      setTrustedDirDraft('')
    )
  }

  const removeTrustedDir = (dir: string) => {
    void saveCapabilityState(
      {},
      capabilityState.trustedExternalDirs.filter((item) => item !== dir)
    )
  }

  const effectLabel = (effect: AgentGateEffect) => {
    if (effect === AgentGateEffect.Allow) return t('settings.agent_gate_effect_allow', '允许')
    if (effect === AgentGateEffect.Deny) return t('settings.agent_gate_effect_deny', '拒绝')
    return t('settings.agent_gate_effect_ask', '询问')
  }

  return (
    <div className={pane.stack}>
      <div className={pane.stackGroup}>
        <div className={pane.sectionLabelRow}>
          <h3 className={pane.sectionLabel}>
            {scene === 'workspace'
              ? t('settings.agent_gate_matrix_title', '能力权限')
              : t('settings.agent_gate_title', '伙伴操作门控')}
          </h3>
          <HelpTooltip
            size={14}
            content={
              scene === 'workspace'
                ? t(
                    'settings.workspace_gate_desc',
                    '仅约束当前工作区内模型调用的工具；你本人在工作台中的编辑、删除与 Git 操作不受影响。'
                  )
                : t(
                    'settings.agent_gate_desc',
                    '控制伙伴执行写入、修改等敏感操作前是否需要你确认。'
                  )
            }
          />
        </div>
        <section className={pane.cardSection}>
          <div className={`${pane.cardBody} ${styles.paddedBody}`}>
          {capabilities.map((cap, index) => {
            const current = capabilityState.effects[cap.id] ?? AgentGateEffect.Ask
            const [titleKey, titleFallback] = CAPABILITY_TITLE_KEYS[cap.id]
            const [hintKey, hintFallback] = CAPABILITY_HINT_KEYS[cap.id]
            const options: AgentGateEffect[] = cap.lockedToAsk
              ? [AgentGateEffect.Ask]
              : cap.disallowAllow
                ? [AgentGateEffect.Ask, AgentGateEffect.Deny]
                : [AgentGateEffect.Allow, AgentGateEffect.Ask, AgentGateEffect.Deny]

            return (
              <React.Fragment key={cap.id}>
                {index > 0 ? <div className={pane.divider} /> : null}
                <div className={styles.matrixRow}>
                  <div className={styles.matrixText}>
                    <div className={styles.matrixTitle}>{t(titleKey, titleFallback)}</div>
                    <div className={styles.matrixHint}>{t(hintKey, hintFallback)}</div>
                  </div>
                  <SegmentedControl
                    aria-label={t(titleKey, titleFallback)}
                    value={current}
                    options={options.map((effect) => ({
                      value: effect,
                      label: effectLabel(effect),
                      disabled: cap.lockedToAsk && effect !== AgentGateEffect.Ask
                    }))}
                    onChange={(effect) => void saveCapabilityState({ [cap.id]: effect })}
                  />
                </div>

                {cap.id === 'external' && scene === 'workspace' ? (
                  <div className={styles.subBlock}>
                    <div className={styles.sectionLabel}>
                      {t('settings.agent_gate_trusted_dirs_title', '可信区外目录')}
                    </div>
                    <p className={styles.emptyHint}>
                      {t(
                        'settings.agent_gate_trusted_dirs_hint',
                        '匹配这些目录的区外路径可通过区外门，再按读取/编辑等能力决定；未匹配仍询问或拒绝。'
                      )}
                    </p>
                    {capabilityState.trustedExternalDirs.length === 0 ? (
                      <p className={styles.emptyHint}>
                        {t('settings.agent_gate_trusted_dirs_empty', '暂无可信目录')}
                      </p>
                    ) : (
                      capabilityState.trustedExternalDirs.map((dir) => (
                        <div key={dir} className="settings-list-tile settings-list-tile-noclick">
                          <div className="settings-list-tile-content">
                            <span className="settings-list-tile-title settings-monospace">
                              {dir}
                            </span>
                          </div>
                          <button
                            type="button"
                            className="settings-text-btn"
                            disabled={saving}
                            onClick={() => removeTrustedDir(dir)}
                          >
                            {t('common.remove', '移除')}
                          </button>
                        </div>
                      ))
                    )}
                    <div className={styles.formRow}>
                      <input
                        className={styles.textInput}
                        value={trustedDirDraft}
                        onChange={(e) => setTrustedDirDraft(e.target.value)}
                        placeholder={t(
                          'settings.agent_gate_trusted_dirs_placeholder',
                          '例如 D:/Notes 或 ~/projects/personal/**'
                        )}
                        disabled={saving}
                      />
                      <button
                        type="button"
                        className="settings-text-btn"
                        disabled={saving}
                        onClick={addTrustedDir}
                      >
                        {t('common.add', '添加')}
                      </button>
                    </div>
                  </div>
                ) : null}

                {cap.id === 'command' && scene === 'workspace' ? (
                  <div className={styles.subBlock}>
                    <div className={styles.sectionLabel}>
                      {t('settings.agent_gate_command_prefixes_title', '始终允许的命令前缀')}
                    </div>
                    <p className={styles.emptyHint}>
                      {t(
                        'settings.agent_gate_command_prefixes_hint',
                        '来自会话中的「始终允许」；仅作用于当前工作区。'
                      )}
                    </p>
                    {commandAllowlist.length === 0 ? (
                      <p className={styles.emptyHint}>
                        {t('settings.agent_gate_command_prefixes_empty', '暂无前缀')}
                      </p>
                    ) : (
                      commandAllowlist.map((entry) => (
                        <div key={entry.id} className="settings-list-tile settings-list-tile-noclick">
                          <div className="settings-list-tile-content">
                            <span className="settings-list-tile-title settings-monospace">
                              {entry.pattern ?? entry.action}
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
                      ))
                    )}
                  </div>
                ) : null}
              </React.Fragment>
            )
          })}

          <div className={pane.divider} />

          <div className="settings-list-tile settings-list-tile-noclick">
            <div className="settings-list-tile-content">
              <span className="settings-list-tile-title">
                {t('settings.agent_gate_hide_denied', '隐藏被拒绝的工具')}
              </span>
              <span className="settings-list-tile-subtitle">
                {t(
                  'settings.agent_gate_hide_denied_hint',
                  '开启后，当前场景下被默认拒绝的工具不会出现在可选列表中。'
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
                {t('settings.agent_gate_repeat_threshold', '同参连打再确认阈值')}
              </span>
              <span className="settings-list-tile-subtitle">
                {t(
                  'settings.agent_gate_repeat_threshold_hint',
                  '相同指纹连续请求达到该次数时再次弹出确认；0 表示关闭。'
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
      </div>

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
                : t(
                    'settings.agent_gate_allowlist_hint',
                    '仅作用于伙伴会话；不会影响工作台。'
                  )
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
      </div>

      <div className={pane.stackGroup}>
        <div className={pane.sectionLabelRow}>
          <h3 className={pane.sectionLabel}>
            {t('settings.agent_gate_advanced_title', '高级规则')}
          </h3>
          <HelpTooltip
            size={14}
            content={t(
              'settings.agent_gate_advanced_hint',
              '面向熟悉 action / pattern 的用户；日常使用可忽略。'
            )}
          />
        </div>
        <section className={pane.cardSection}>
          <div className={`${pane.cardBody} ${styles.paddedBody}`}>
            <button
              type="button"
              className="settings-text-btn"
              onClick={() => setShowAdvanced((v) => !v)}
            >
              {showAdvanced
                ? t('settings.agent_gate_advanced_hide', '收起高级规则')
                : t('settings.agent_gate_advanced_show', '展开高级规则')}
            </button>

            {showAdvanced ? (
              <>
                <ProfileRulesReadonly
                  title={
                    scene === 'workspace'
                      ? t('settings.agent_gate_profile_workspace', '工作区会话默认')
                      : t('settings.agent_gate_profile_companion', '伙伴会话默认')
                  }
                  rules={[...AGENT_GATE_PROFILE_DEFAULT_RULES[profileId]]}
                />

                <div className={styles.sectionLabel}>
                  {t('settings.agent_gate_exclusion_title', '始终需确认的操作')}
                </div>
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

                <div className={styles.sectionLabel}>
                  {t('settings.agent_gate_user_rules', '我的额外规则')}
                </div>
                {permissionRules.length === 0 ? (
                  <p className={styles.emptyHint}>
                    {t('settings.agent_gate_user_rules_empty', '暂无')}
                  </p>
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
              </>
            ) : null}
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
              <label className="settings-switch-label">
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
              <label className="settings-switch-label">
                <input
                  type="checkbox"
                  checked={notificationPrefs.soundEnabled}
                  disabled={saving || !notificationPrefs.enabled}
                  onChange={(e) => void updateNotificationPrefs({ soundEnabled: e.target.checked })}
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
