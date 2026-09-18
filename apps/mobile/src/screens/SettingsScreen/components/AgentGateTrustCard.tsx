import React from 'react'
import { View, Text } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Input, Switch, useNativeTheme } from '@baishou/ui/native'
import { SettingsGroupCard } from './SettingsGroupCard'
import { agentGateSettingsStyles as styles } from './agent-gate-settings.styles'

export function AgentGateTrustCard(props: {
  isFullTrust: boolean
  hideDeniedTools: boolean
  threshold: number
  onTrustToggle: (v: boolean) => void
  onHideDeniedToggle: (v: boolean) => void
  onThresholdChange: (text: string) => void
}) {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const {
    isFullTrust,
    hideDeniedTools,
    threshold,
    onTrustToggle,
    onHideDeniedToggle,
    onThresholdChange
  } = props

  return (
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
        <Switch value={isFullTrust} onValueChange={onTrustToggle} />
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
        <Switch value={hideDeniedTools} onValueChange={onHideDeniedToggle} />
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
        onChangeText={onThresholdChange}
        containerStyle={{ marginTop: 4 }}
      />
    </SettingsGroupCard>
  )
}
