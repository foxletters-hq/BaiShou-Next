import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AGENT_GATE_PROFILE_DEFAULT_RULES,
  AgentGateEffect,
  AgentGateProfileId,
  type AgentGatePermissionRule,
  type AgentToolScene,
  type BaishouAgentGateConfig
} from '@baishou/shared'
import { Button, HelpTooltip, Input, Select } from '@baishou/ui'
import { ChevronDown } from 'lucide-react'
import '@baishou/ui/desktop/shared/SettingsListTile.css'
import {
  buildPermissionRule,
  movePermissionRule,
  nextExclusionList,
  resolveExclusionList,
  workspaceCustomPresetPatch
} from './agent-gate-settings.util'
import pane from './GeneralSettingsPane.module.css'
import styles from './AgentGateSettings.module.css'

export interface AgentGateAdvancedRulesSectionProps {
  scene: AgentToolScene
  config: BaishouAgentGateConfig
  saving: boolean
  onPatchConfig: (patch: Partial<BaishouAgentGateConfig>) => void | Promise<void>
}

export const AgentGateAdvancedRulesSection: React.FC<AgentGateAdvancedRulesSectionProps> = ({
  scene,
  config,
  saving,
  onPatchConfig
}) => {
  const { t } = useTranslation()
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [exclusionDraft, setExclusionDraft] = useState('')
  const [ruleAction, setRuleAction] = useState('')
  const [rulePattern, setRulePattern] = useState('')
  const [ruleEffect, setRuleEffect] = useState<AgentGateEffect>(AgentGateEffect.Ask)

  const exclusionList = resolveExclusionList(config, scene)
  const permissionRules = config.permissionRules ?? []
  const profileId =
    scene === 'workspace' ? AgentGateProfileId.Workspace : AgentGateProfileId.Companion

  const addExclusion = () => {
    const next = nextExclusionList(exclusionList, exclusionDraft)
    if (next === 'empty') return
    if (next === 'duplicate') {
      setExclusionDraft('')
      return
    }
    void Promise.resolve(onPatchConfig({ exclusionList: next })).then(() => setExclusionDraft(''))
  }

  const addPermissionRule = () => {
    const rule = buildPermissionRule(ruleAction, ruleEffect, rulePattern)
    if (!rule) return
    void Promise.resolve(
      onPatchConfig({
        permissionRules: [...permissionRules, rule],
        ...workspaceCustomPresetPatch(scene)
      })
    ).then(() => {
      setRuleAction('')
      setRulePattern('')
      setRuleEffect(AgentGateEffect.Ask)
    })
  }

  const removePermissionRuleAt = (index: number) => {
    void onPatchConfig({
      permissionRules: permissionRules.filter((_, i) => i !== index),
      ...workspaceCustomPresetPatch(scene)
    })
  }

  const shiftPermissionRule = (index: number, delta: number) => {
    const next = movePermissionRule(permissionRules, index, delta)
    if (!next) return
    void onPatchConfig({
      permissionRules: next,
      ...workspaceCustomPresetPatch(scene)
    })
  }

  return (
    <div className={pane.stackGroup}>
      <div className={pane.sectionLabelRow}>
        <h3 className={pane.sectionLabel}>{t('settings.agent_gate_advanced_title', '高级规则')}</h3>
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
            className="settings-list-tile"
            aria-expanded={showAdvanced}
            onClick={() => setShowAdvanced((v) => !v)}
          >
            <div className="settings-list-tile-content">
              <span className="settings-list-tile-title">
                {t('settings.agent_gate_advanced_toggle_title', '高级规则详情')}
              </span>
              <span className="settings-list-tile-subtitle">
                {t(
                  'settings.agent_gate_advanced_toggle_hint',
                  '场景默认、始终确认列表与额外规则表'
                )}
              </span>
            </div>
            <span
              className={`settings-expansion-toggle ${showAdvanced ? 'is-open' : ''}`}
              aria-hidden
            >
              <ChevronDown className="settings-expansion-arrow" size={16} />
            </span>
          </button>

          {showAdvanced ? (
            <>
              <div className={pane.divider} />
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
                    <Button
                      type="button"
                      disabled={saving}
                      onClick={() =>
                        void onPatchConfig({
                          exclusionList: exclusionList.filter((item) => item !== action)
                        })
                      }
                    >
                      {t('common.remove', '移除')}
                    </Button>
                  </div>
                </React.Fragment>
              ))}
              <div className={styles.formRow}>
                <Input
                  fieldSize="small"
                  className={styles.textInput}
                  value={exclusionDraft}
                  onChange={(e) => setExclusionDraft(e.target.value)}
                  placeholder="e.g. workspace_run"
                  disabled={saving}
                />
                <Button type="button" disabled={saving} onClick={addExclusion}>
                  {t('common.add', '添加')}
                </Button>
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
                        <span className="settings-list-tile-desc">
                          {t(
                            'settings.agent_gate_rule_order_hint',
                            '顺序即优先级：越靠后覆盖越靠前'
                          )}
                        </span>
                      </div>
                      <Button
                        type="button"
                        disabled={saving || index === 0}
                        onClick={() => shiftPermissionRule(index, -1)}
                        aria-label={t('settings.agent_gate_rule_move_up', '上移')}
                      >
                        ↑
                      </Button>
                      <Button
                        type="button"
                        disabled={saving || index === permissionRules.length - 1}
                        onClick={() => shiftPermissionRule(index, 1)}
                        aria-label={t('settings.agent_gate_rule_move_down', '下移')}
                      >
                        ↓
                      </Button>
                      <Button
                        type="button"
                        disabled={saving}
                        onClick={() => removePermissionRuleAt(index)}
                      >
                        {t('common.remove', '移除')}
                      </Button>
                    </div>
                  </React.Fragment>
                ))
              )}
              <div className={styles.formRow}>
                <Input
                  fieldSize="small"
                  className={styles.textInput}
                  value={ruleAction}
                  onChange={(e) => setRuleAction(e.target.value)}
                  placeholder={t(
                    'settings.agent_gate_rule_action_placeholder',
                    'action (supports workspace_*)'
                  )}
                  disabled={saving}
                />
                <Input
                  fieldSize="small"
                  className={styles.textInput}
                  value={rulePattern}
                  onChange={(e) => setRulePattern(e.target.value)}
                  placeholder={t(
                    'settings.agent_gate_rule_pattern_placeholder',
                    'optional pattern'
                  )}
                  disabled={saving}
                />
                <Select
                  className={styles.ruleEffectSelect}
                  size="small"
                  disabled={saving}
                  value={ruleEffect}
                  options={[
                    {
                      value: AgentGateEffect.Allow,
                      label: t('settings.agent_gate_effect_allow', '允许')
                    },
                    {
                      value: AgentGateEffect.Ask,
                      label: t('settings.agent_gate_effect_ask', '询问')
                    },
                    {
                      value: AgentGateEffect.Deny,
                      label: t('settings.agent_gate_effect_deny', '拒绝')
                    }
                  ]}
                  onChange={(e) => setRuleEffect(e.target.value as AgentGateEffect)}
                />
                <Button type="button" disabled={saving} onClick={addPermissionRule}>
                  {t('common.add', '添加')}
                </Button>
              </div>
            </>
          ) : null}
        </div>
      </section>
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
