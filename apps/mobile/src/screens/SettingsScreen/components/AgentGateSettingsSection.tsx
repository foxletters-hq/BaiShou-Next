/* eslint-disable max-lines -- 移动端伙伴门控设置矩阵与规则同页 */
import React, { useCallback, useEffect, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, LayoutAnimation } from 'react-native'
import { useTranslation } from 'react-i18next'
import {
  AGENT_GATE_PROFILE_DEFAULT_RULES,
  AgentGateEffect,
  AgentGateProfileId,
  AgentGateTrustMode,
  BAISHOU_AGENT_GATE_CONFIG_KEY,
  DEFAULT_AGENT_GATE_EXCLUSION_LIST,
  DEFAULT_AGENT_GATE_NOTIFICATION_PREFS,
  DEFAULT_AGENT_GATE_REPEAT_ASSERT_ASK_THRESHOLD,
  type AgentGateNotificationPrefs,
  type BaishouAgentGateConfig,
  type AgentGateAllowlistEntry,
  type AgentGatePermissionRule
} from '@baishou/shared'
import {
  getMobileAgentGateNotificationPrefs,
  setMobileAgentGateNotificationPrefs
} from '../../../services/mobile-agent-gate-notification-prefs.service'
import { DEFAULT_BAISHOU_AGENT_GATE_CONFIG } from '@baishou/database'
import { Switch, useNativeTheme, useNativeToast, Input } from '@baishou/ui/native'
import { useBaishou } from '../../../providers/BaishouProvider'
import { SettingsGroupCard } from './SettingsGroupCard'

export const AgentGateSettingsSection: React.FC = () => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const toast = useNativeToast()
  const { services, dbReady, reloadAgentGateConfig } = useBaishou()
  const [config, setConfig] = useState<BaishouAgentGateConfig>(DEFAULT_BAISHOU_AGENT_GATE_CONFIG)
  const [exclusionDraft, setExclusionDraft] = useState('')
  const [ruleAction, setRuleAction] = useState('')
  const [rulePattern, setRulePattern] = useState('')
  const [ruleEffect, setRuleEffect] = useState<AgentGateEffect>(AgentGateEffect.Ask)
  const [notificationPrefs, setNotificationPrefs] = useState<AgentGateNotificationPrefs>(
    DEFAULT_AGENT_GATE_NOTIFICATION_PREFS
  )

  const loadConfig = useCallback(async () => {
    if (!services || !dbReady) return
    const saved =
      (await services.settingsManager.get<BaishouAgentGateConfig>(BAISHOU_AGENT_GATE_CONFIG_KEY)) ??
      DEFAULT_BAISHOU_AGENT_GATE_CONFIG
    setConfig({
      ...DEFAULT_BAISHOU_AGENT_GATE_CONFIG,
      ...saved,
      exclusionList: [...(saved.exclusionList ?? DEFAULT_BAISHOU_AGENT_GATE_CONFIG.exclusionList)],
      allowlist: [...(saved.allowlist ?? [])],
      permissionRules: [...(saved.permissionRules ?? [])]
    })
    setNotificationPrefs(await getMobileAgentGateNotificationPrefs())
  }, [services, dbReady])

  useEffect(() => {
    void loadConfig()
  }, [loadConfig])

  const updateNotificationPrefs = async (patch: Partial<AgentGateNotificationPrefs>) => {
    const next = await setMobileAgentGateNotificationPrefs(patch)
    setNotificationPrefs(next)
  }

  const persist = useCallback(
    async (next: BaishouAgentGateConfig) => {
      if (!services || !dbReady) return
      await services.settingsManager.set(BAISHOU_AGENT_GATE_CONFIG_KEY, next)
      setConfig(next)
      await reloadAgentGateConfig?.()
    },
    [services, dbReady, reloadAgentGateConfig]
  )

  const handleTrustToggle = (fullTrust: boolean) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    void persist({
      ...config,
      trustMode: fullTrust ? AgentGateTrustMode.FullTrust : AgentGateTrustMode.Manual
    })
  }

  const handleBoolToggle = (key: 'hideDeniedTools' | 'forceAskExternalPath', value: boolean) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    void persist({
      ...config,
      [key]: value
    })
  }

  const handleRemoveAllowlist = async (entry: AgentGateAllowlistEntry) => {
    const next = {
      ...config,
      allowlist: config.allowlist.filter((item) => item.id !== entry.id)
    }
    try {
      await persist(next)
      toast.showSuccess(t('agent.gate.allowlist_removed', '已从白名单移除'))
    } catch {
      toast.showError(t('common.errors.save_failed', '保存失败'))
    }
  }

  const isFullTrust = config.trustMode === AgentGateTrustMode.FullTrust
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
    void persist({ ...config, exclusionList: [...exclusionList, action] }).then(() =>
      setExclusionDraft('')
    )
  }

  const removeExclusion = (action: string) => {
    void persist({
      ...config,
      exclusionList: exclusionList.filter((item) => item !== action)
    })
  }

  const addPermissionRule = () => {
    const action = ruleAction.trim()
    if (!action) return
    const next: AgentGatePermissionRule = {
      action,
      effect: ruleEffect,
      ...(rulePattern.trim() ? { pattern: rulePattern.trim() } : {})
    }
    void persist({
      ...config,
      permissionRules: [...permissionRules, next]
    }).then(() => {
      setRuleAction('')
      setRulePattern('')
      setRuleEffect(AgentGateEffect.Ask)
    })
  }

  const removePermissionRule = (index: number) => {
    void persist({
      ...config,
      permissionRules: permissionRules.filter((_, i) => i !== index)
    })
  }

  const removeBtn = (onPress: () => void) => (
    <TouchableOpacity onPress={onPress} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
      <Text style={[styles.removeText, { color: colors.error }]}>{t('common.remove', '移除')}</Text>
    </TouchableOpacity>
  )

  return (
    <>
      <SettingsGroupCard>
        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
          {t('agent.gate.settings_title', 'Agent 操作确认')}
        </Text>
        <Text style={[styles.desc, { color: colors.textSecondary }]}>
          {t('agent.gate.settings_desc', '控制伙伴执行写入、修改等敏感操作前是否需要你确认。')}
        </Text>

        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={[styles.label, { color: colors.textPrimary }]}>
              {t('agent.gate.full_trust', '完全信任模式')}
            </Text>
            <Text style={[styles.hint, { color: colors.textSecondary }]}>
              {t(
                'agent.gate.full_trust_hint',
                '开启后除高危操作外自动放行；关闭时每次敏感操作需确认'
              )}
            </Text>
          </View>
          <Switch value={isFullTrust} onValueChange={handleTrustToggle} />
        </View>

        <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={[styles.label, { color: colors.textPrimary }]}>
              {t('agent.gate.hide_denied', '隐藏被拒绝的工具')}
            </Text>
            <Text style={[styles.hint, { color: colors.textSecondary }]}>
              {t(
                'agent.gate.hide_denied_hint',
                '开启后，当前场景下被默认拒绝的工具不会出现在可选列表中'
              )}
            </Text>
          </View>
          <Switch
            value={config.hideDeniedTools !== false}
            onValueChange={(v) => handleBoolToggle('hideDeniedTools', v)}
          />
        </View>

        <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={[styles.label, { color: colors.textPrimary }]}>
              {t('agent.gate.force_ask_external', '工作区外路径强制确认')}
            </Text>
            <Text style={[styles.hint, { color: colors.textSecondary }]}>
              {t(
                'agent.gate.force_ask_external_hint',
                '触及工作区外路径时始终确认，即使完全信任或已始终允许'
              )}
            </Text>
          </View>
          <Switch
            value={config.forceAskExternalPath !== false}
            onValueChange={(v) => handleBoolToggle('forceAskExternalPath', v)}
          />
        </View>

        <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />
        <Text style={[styles.label, { color: colors.textPrimary }]}>
          {t('agent.gate.repeat_threshold', '同参连打再确认阈值')}
        </Text>
        <Text style={[styles.hint, { color: colors.textSecondary, marginBottom: 6 }]}>
          {t(
            'agent.gate.repeat_threshold_hint',
            '相同指纹连续请求达到该次数时再次弹出；0 关闭。确认卡会显示短指纹。'
          )}
        </Text>
        <Input
          value={String(threshold)}
          keyboardType="number-pad"
          onChangeText={(text) => {
            const n = Number(text)
            if (!Number.isFinite(n)) return
            void persist({
              ...config,
              repeatAssertAskThreshold: Math.max(0, Math.min(20, Math.floor(n)))
            })
          }}
          containerStyle={{ marginTop: 4 }}
        />
      </SettingsGroupCard>

      <SettingsGroupCard>
        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
          {t('agent.gate.profile_title', '场景默认松紧')}
        </Text>
        <Text style={[styles.desc, { color: colors.textSecondary }]}>
          {t(
            'agent.gate.profile_hint',
            '伙伴会话与工作区会话使用不同默认规则；下方可叠加你的自定义规则。'
          )}
        </Text>
        <ProfileRulesReadonly
          title={t('agent.gate.profile_companion', '伙伴会话')}
          rules={[...AGENT_GATE_PROFILE_DEFAULT_RULES[AgentGateProfileId.Companion]]}
          colors={colors}
        />
        <ProfileRulesReadonly
          title={t('agent.gate.profile_workspace', '工作区会话')}
          rules={[...AGENT_GATE_PROFILE_DEFAULT_RULES[AgentGateProfileId.Workspace]]}
          colors={colors}
        />

        <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />
        <Text style={[styles.label, { color: colors.textPrimary, marginBottom: 8 }]}>
          {t('agent.gate.user_rules', '我的额外规则')}
        </Text>
        {permissionRules.length === 0 ? (
          <Text style={[styles.empty, { color: colors.textSecondary }]}>
            {t('agent.gate.user_rules_empty', '暂无')}
          </Text>
        ) : (
          permissionRules.map((rule, index) => (
            <View
              key={`${rule.action}-${index}`}
              style={[styles.listRow, { borderBottomColor: colors.borderSubtle }]}
            >
              <Text style={[styles.listPrimary, { color: colors.textPrimary, flex: 1 }]}>
                {rule.action}
                {rule.pattern ? ` · ${rule.pattern}` : ''} → {rule.effect}
              </Text>
              {removeBtn(() => removePermissionRule(index))}
            </View>
          ))
        )}
        <Input
          value={ruleAction}
          onChangeText={setRuleAction}
          placeholder="action"
          autoCapitalize="none"
          autoCorrect={false}
          containerStyle={{ marginTop: 8 }}
        />
        <Input
          value={rulePattern}
          onChangeText={setRulePattern}
          placeholder={t('agent.gate.rule_pattern_optional', '可选 pattern')}
          autoCapitalize="none"
          autoCorrect={false}
          containerStyle={{ marginTop: 8 }}
        />
        <View style={styles.effectRow}>
          {([AgentGateEffect.Allow, AgentGateEffect.Ask, AgentGateEffect.Deny] as const).map(
            (effect) => {
              const active = ruleEffect === effect
              return (
                <TouchableOpacity
                  key={effect}
                  style={[
                    styles.effectChip,
                    {
                      borderColor: active ? colors.primary : colors.borderMuted,
                      backgroundColor: active ? colors.primaryLight : 'transparent'
                    }
                  ]}
                  onPress={() => setRuleEffect(effect)}
                >
                  <Text
                    style={{
                      color: active ? colors.primary : colors.textSecondary,
                      fontWeight: active ? '600' : '400',
                      fontSize: 13
                    }}
                  >
                    {effect}
                  </Text>
                </TouchableOpacity>
              )
            }
          )}
          <TouchableOpacity
            onPress={addPermissionRule}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[styles.addText, { color: colors.primary }]}>
              {t('common.add', '添加')}
            </Text>
          </TouchableOpacity>
        </View>
      </SettingsGroupCard>

      <SettingsGroupCard>
        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
          {t('agent.gate.allowlist_title', '始终允许的操作')}
        </Text>
        {config.allowlist.length === 0 ? (
          <Text style={[styles.empty, { color: colors.textSecondary }]}>
            {t('agent.gate.allowlist_empty', '暂无；在对话中点「始终允许」后会出现在这里')}
          </Text>
        ) : (
          config.allowlist.map((entry) => (
            <View
              key={entry.id}
              style={[styles.listRow, { borderBottomColor: colors.borderSubtle }]}
            >
              <View style={styles.listText}>
                <Text style={[styles.listPrimary, { color: colors.textPrimary }]}>
                  {entry.action}
                </Text>
                <Text style={[styles.listMeta, { color: colors.textSecondary }]}>
                  {entry.pattern
                    ? t('agent.gate.allowlist_pattern', '模式：{{pattern}}', {
                        pattern: entry.pattern
                      })
                    : t('agent.gate.allowlist_whole', '整工具')}
                  {' · '}
                  {new Date(entry.createdAt).toLocaleString()}
                </Text>
              </View>
              {removeBtn(() => void handleRemoveAllowlist(entry))}
            </View>
          ))
        )}
      </SettingsGroupCard>

      <SettingsGroupCard>
        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
          {t('agent.gate.exclusion_title', '每次都需确认（不能始终允许）')}
        </Text>
        <Text style={[styles.desc, { color: colors.textSecondary }]}>
          {t(
            'agent.gate.exclusion_hint',
            '下列高危操作即使开启完全信任，仍会征求你的确认，且无法加入始终允许。可增删。'
          )}
        </Text>
        {exclusionList.map((action) => (
          <View key={action} style={[styles.listRow, { borderBottomColor: colors.borderSubtle }]}>
            <Text style={[styles.listPrimary, { color: colors.textPrimary, flex: 1 }]}>
              {action}
            </Text>
            {removeBtn(() => removeExclusion(action))}
          </View>
        ))}
        <View style={styles.addRow}>
          <Input
            value={exclusionDraft}
            onChangeText={setExclusionDraft}
            placeholder="action"
            autoCapitalize="none"
            autoCorrect={false}
            containerStyle={{ flex: 1 }}
          />
          <TouchableOpacity
            onPress={addExclusion}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[styles.addText, { color: colors.primary }]}>
              {t('common.add', '添加')}
            </Text>
          </TouchableOpacity>
        </View>
      </SettingsGroupCard>

      <SettingsGroupCard>
        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
          {t('settings.agent_gate_notifications_title', '系统通知')}
        </Text>
        <Text style={[styles.desc, { color: colors.textSecondary }]}>
          {t(
            'settings.agent_gate_notifications_hint',
            '设备级偏好，不写入权限策略。开启时才会申请系统通知权限；拒绝后仍保留应用内角标与队列。'
          )}
        </Text>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={[styles.label, { color: colors.textPrimary }]}>
              {t('settings.agent_gate_notify_enabled', '系统通知')}
            </Text>
          </View>
          <Switch
            value={notificationPrefs.enabled}
            onValueChange={(value) => void updateNotificationPrefs({ enabled: value })}
          />
        </View>
        <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={[styles.label, { color: colors.textPrimary }]}>
              {t('settings.agent_gate_notify_sound', '通知声音')}
            </Text>
          </View>
          <Switch
            value={notificationPrefs.soundEnabled}
            disabled={!notificationPrefs.enabled}
            onValueChange={(value) => void updateNotificationPrefs({ soundEnabled: value })}
          />
        </View>
      </SettingsGroupCard>
    </>
  )
}

function ProfileRulesReadonly({
  title,
  rules,
  colors
}: {
  title: string
  rules: AgentGatePermissionRule[]
  colors: { textPrimary: string; textSecondary: string }
}) {
  return (
    <View style={styles.profileBlock}>
      <Text style={[styles.profileTitle, { color: colors.textPrimary }]}>{title}</Text>
      {rules.map((rule) => (
        <Text
          key={`${rule.action}-${rule.effect}-${rule.pattern ?? ''}`}
          style={[styles.profileRule, { color: colors.textSecondary }]}
        >
          {rule.action}
          {rule.pattern ? ` (${rule.pattern})` : ''} → {rule.effect}
        </Text>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8
  },
  desc: {
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 12
  },
  divider: {
    height: 1,
    marginVertical: 14
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  rowText: {
    flex: 1,
    gap: 4
  },
  label: {
    fontSize: 14,
    fontWeight: '600'
  },
  hint: {
    fontSize: 12,
    lineHeight: 18
  },
  empty: {
    fontSize: 13,
    lineHeight: 20,
    paddingVertical: 4
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  listText: {
    flex: 1,
    gap: 2,
    paddingRight: 12
  },
  listPrimary: {
    fontSize: 14,
    fontWeight: '600'
  },
  listMeta: {
    fontSize: 11
  },
  removeText: {
    fontSize: 13,
    fontWeight: '600'
  },
  addText: {
    fontSize: 13,
    fontWeight: '600'
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8
  },
  effectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10
  },
  effectChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth
  },
  profileBlock: {
    marginBottom: 12,
    gap: 4
  },
  profileTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2
  },
  profileRule: {
    fontSize: 12,
    lineHeight: 18
  }
})
