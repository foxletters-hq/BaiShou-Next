import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'
import {
  resolveAgentToolActionLabel,
  type AgentGateAllowlistEntry,
  type AgentGateNotificationPrefs
} from '@baishou/shared'
import { Input, Switch, useNativeTheme } from '@baishou/ui/native'
import { SettingsGroupCard } from './SettingsGroupCard'
import { agentGateSettingsStyles as styles } from './agent-gate-settings.styles'

export function AgentGateListsCard(props: {
  allowlist: AgentGateAllowlistEntry[]
  exclusionList: string[]
  exclusionDraft: string
  notificationPrefs: AgentGateNotificationPrefs
  onRemoveAllowlist: (entry: AgentGateAllowlistEntry) => void
  onExclusionDraft: (v: string) => void
  onAddExclusion: () => void
  onRemoveExclusion: (action: string) => void
  onNotificationPrefs: (patch: Partial<AgentGateNotificationPrefs>) => void
}) {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const {
    allowlist,
    exclusionList,
    exclusionDraft,
    notificationPrefs,
    onRemoveAllowlist,
    onExclusionDraft,
    onAddExclusion,
    onRemoveExclusion,
    onNotificationPrefs
  } = props

  return (
    <>
      <SettingsGroupCard>
        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
          {t('agent.gate.allowlist_title', '始终允许的操作')}
        </Text>
        {allowlist.length === 0 ? (
          <Text style={[styles.empty, { color: colors.textSecondary }]}>
            {t('agent.gate.allowlist_empty', '暂无；在对话中点「始终允许」后会出现在这里')}
          </Text>
        ) : (
          allowlist.map((entry) => (
            <View
              key={entry.id}
              style={[styles.listRow, { borderBottomColor: colors.borderSubtle }]}
            >
              <View style={styles.listText}>
                <Text style={[styles.listPrimary, { color: colors.textPrimary }]}>
                  {resolveAgentToolActionLabel(entry.action, t)}
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
              <TouchableOpacity
                onPress={() => void onRemoveAllowlist(entry)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={[styles.removeText, { color: colors.error }]}>
                  {t('common.remove', '移除')}
                </Text>
              </TouchableOpacity>
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
            <TouchableOpacity
              onPress={() => onRemoveExclusion(action)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={[styles.removeText, { color: colors.error }]}>
                {t('common.remove', '移除')}
              </Text>
            </TouchableOpacity>
          </View>
        ))}
        <View style={styles.addRow}>
          <Input
            value={exclusionDraft}
            onChangeText={onExclusionDraft}
            placeholder="action"
            autoCapitalize="none"
            autoCorrect={false}
            containerStyle={{ flex: 1 }}
          />
          <TouchableOpacity
            onPress={onAddExclusion}
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
            onValueChange={(value) => void onNotificationPrefs({ enabled: value })}
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
            onValueChange={(value) => void onNotificationPrefs({ soundEnabled: value })}
          />
        </View>
      </SettingsGroupCard>
    </>
  )
}
