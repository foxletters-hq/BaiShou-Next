import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'
import {
  AGENT_GATE_PROFILE_DEFAULT_RULES,
  AgentGateEffect,
  AgentGateProfileId,
  resolveWorkspaceSecurityMode,
  type AgentGatePermissionRule,
  type AgentWorkspaceSecurityMode,
  type BaishouAgentGateConfig
} from '@baishou/shared'
import { Input, SegmentedControl, useNativeTheme } from '@baishou/ui/native'
import { SettingsGroupCard } from './SettingsGroupCard'
import { agentGateSettingsStyles as styles } from './agent-gate-settings.styles'

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

export function AgentGateProfileCard(props: {
  config: BaishouAgentGateConfig
  permissionRules: AgentGatePermissionRule[]
  ruleAction: string
  rulePattern: string
  ruleEffect: AgentGateEffect
  onWorkspaceMode: (mode: AgentWorkspaceSecurityMode) => void
  onRuleAction: (v: string) => void
  onRulePattern: (v: string) => void
  onRuleEffect: (v: AgentGateEffect) => void
  onAddRule: () => void
  onRemoveRule: (index: number) => void
}) {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const {
    config,
    permissionRules,
    ruleAction,
    rulePattern,
    ruleEffect,
    onWorkspaceMode,
    onRuleAction,
    onRulePattern,
    onRuleEffect,
    onAddRule,
    onRemoveRule
  } = props

  return (
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
      <Text style={[styles.profileTitle, { color: colors.textPrimary, marginTop: 12 }]}>
        {t('agent.gate.profile_workspace', '工作区会话')}
      </Text>
      <Text style={[styles.desc, { color: colors.textSecondary }]}>
        {t(
          'agent.gate.workspace_mobile_hint',
          '这些规则在桌面工作台会话生效。手机没有工作台入口，也不会注册工作台运行工具。'
        )}
      </Text>
      <SegmentedControl
        value={resolveWorkspaceSecurityMode(config)}
        onChange={onWorkspaceMode}
        options={[
          { value: 'full_access', label: t('settings.agent_security_full_access', '完全访问') },
          { value: 'auto_review', label: t('settings.agent_security_auto_review', '自动审核') },
          { value: 'allow_list', label: t('settings.agent_security_allow_list', '白名单') }
        ]}
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
            <TouchableOpacity
              onPress={() => onRemoveRule(index)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={[styles.removeText, { color: colors.error }]}>
                {t('common.remove', '移除')}
              </Text>
            </TouchableOpacity>
          </View>
        ))
      )}
      <Input
        value={ruleAction}
        onChangeText={onRuleAction}
        placeholder="action"
        autoCapitalize="none"
        autoCorrect={false}
        containerStyle={{ marginTop: 8 }}
      />
      <Input
        value={rulePattern}
        onChangeText={onRulePattern}
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
                onPress={() => onRuleEffect(effect)}
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
        <TouchableOpacity onPress={onAddRule} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={[styles.addText, { color: colors.primary }]}>{t('common.add', '添加')}</Text>
        </TouchableOpacity>
      </View>
    </SettingsGroupCard>
  )
}
