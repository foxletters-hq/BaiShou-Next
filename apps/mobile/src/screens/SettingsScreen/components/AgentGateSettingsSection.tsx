import React, { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  LayoutAnimation,
  TextInput
} from 'react-native'
import { useTranslation } from 'react-i18next'
import {
  AgentGateTrustMode,
  BAISHOU_AGENT_GATE_CONFIG_KEY,
  DEFAULT_AGENT_GATE_EXCLUSION_LIST,
  DEFAULT_AGENT_GATE_REPEAT_ASSERT_ASK_THRESHOLD,
  type BaishouAgentGateConfig,
  type AgentGateAllowlistEntry
} from '@baishou/shared'
import { DEFAULT_BAISHOU_AGENT_GATE_CONFIG } from '@baishou/database'
import { Switch, useNativeTheme, useNativeToast } from '@baishou/ui/native'
import { useBaishou } from '../../../providers/BaishouProvider'
import { SettingsGroupCard } from './SettingsGroupCard'

export const AgentGateSettingsSection: React.FC = () => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const toast = useNativeToast()
  const { services, dbReady, reloadAgentGateConfig } = useBaishou()
  const [config, setConfig] = useState<BaishouAgentGateConfig>(DEFAULT_BAISHOU_AGENT_GATE_CONFIG)
  const [exclusionDraft, setExclusionDraft] = useState('')

  const loadConfig = useCallback(async () => {
    if (!services || !dbReady) return
    const saved =
      (await services.settingsManager.get<BaishouAgentGateConfig>(BAISHOU_AGENT_GATE_CONFIG_KEY)) ??
      DEFAULT_BAISHOU_AGENT_GATE_CONFIG
    setConfig({
      ...DEFAULT_BAISHOU_AGENT_GATE_CONFIG,
      ...saved,
      exclusionList: [...(saved.exclusionList ?? DEFAULT_BAISHOU_AGENT_GATE_CONFIG.exclusionList)],
      allowlist: [...(saved.allowlist ?? [])]
    })
  }, [services, dbReady])

  useEffect(() => {
    void loadConfig()
  }, [loadConfig])

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

  const handleBoolToggle = (
    key: 'hideDeniedTools' | 'forceAskExternalPath',
    value: boolean
  ) => {
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
  const exclusionList =
    config.exclusionList.length > 0
      ? config.exclusionList
      : [...DEFAULT_AGENT_GATE_EXCLUSION_LIST]
  const threshold =
    config.repeatAssertAskThreshold ?? DEFAULT_AGENT_GATE_REPEAT_ASSERT_ASK_THRESHOLD

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

  return (
    <View style={styles.section}>
      <SettingsGroupCard>
        <Text style={[styles.groupTitle, { color: colors.textPrimary }]}>
          {t('agent.gate.settings_title', 'Agent 操作确认')}
        </Text>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={[styles.label, { color: colors.textPrimary }]}>
              {t('agent.gate.full_trust', '完全信任模式')}
            </Text>
            <Text style={[styles.hint, { color: colors.textTertiary }]}>
              {t(
                'agent.gate.full_trust_hint',
                '开启后除高危操作外自动放行；关闭时每次敏感操作需确认'
              )}
            </Text>
          </View>
          <Switch value={isFullTrust} onValueChange={handleTrustToggle} />
        </View>
        <View style={[styles.row, styles.rowDivider, { borderTopColor: colors.borderSubtle }]}>
          <View style={styles.rowText}>
            <Text style={[styles.label, { color: colors.textPrimary }]}>
              {t('agent.gate.hide_denied', '隐藏被拒绝的工具')}
            </Text>
            <Text style={[styles.hint, { color: colors.textTertiary }]}>
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
        <View style={[styles.row, styles.rowDivider, { borderTopColor: colors.borderSubtle }]}>
          <View style={styles.rowText}>
            <Text style={[styles.label, { color: colors.textPrimary }]}>
              {t('agent.gate.force_ask_external', '工作区外路径强制确认')}
            </Text>
            <Text style={[styles.hint, { color: colors.textTertiary }]}>
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
        <View style={[styles.row, styles.rowDivider, { borderTopColor: colors.borderSubtle }]}>
          <View style={styles.rowText}>
            <Text style={[styles.label, { color: colors.textPrimary }]}>
              {t('agent.gate.repeat_threshold', '同参连打再确认阈值')}
            </Text>
            <Text style={[styles.hint, { color: colors.textTertiary }]}>
              {t(
                'agent.gate.repeat_threshold_hint',
                '相同指纹连续请求达到该次数时再次弹出；0 关闭。确认卡会显示短指纹。'
              )}
            </Text>
            <TextInput
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
              style={[
                styles.input,
                { color: colors.textPrimary, borderColor: colors.borderSubtle }
              ]}
            />
          </View>
        </View>
      </SettingsGroupCard>

      <SettingsGroupCard>
        <Text style={[styles.groupTitle, { color: colors.textPrimary }]}>
          {t('agent.gate.allowlist_title', '始终允许的操作')}
        </Text>
        {config.allowlist.length === 0 ? (
          <Text style={[styles.empty, { color: colors.textTertiary }]}>
            {t('agent.gate.allowlist_empty', '暂无；在对话中点「始终允许」后会出现在这里')}
          </Text>
        ) : (
          config.allowlist.map((entry) => (
            <View
              key={entry.id}
              style={[styles.allowlistRow, { borderBottomColor: colors.borderSubtle }]}
            >
              <View style={styles.allowlistText}>
                <Text style={[styles.allowlistAction, { color: colors.textPrimary }]}>
                  {entry.action}
                </Text>
                <Text style={[styles.allowlistMeta, { color: colors.textTertiary }]}>
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
                onPress={() => void handleRemoveAllowlist(entry)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t('common.delete', '删除')}
              >
                <Text style={{ color: colors.error, fontSize: 13, fontWeight: '600' }}>
                  {t('common.remove', '移除')}
                </Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </SettingsGroupCard>

      <SettingsGroupCard>
        <Text style={[styles.groupTitle, { color: colors.textPrimary }]}>
          {t('agent.gate.exclusion_title', '每次都需确认（不能始终允许）')}
        </Text>
        <Text style={[styles.hint, { color: colors.textTertiary, marginBottom: 8 }]}>
          {t(
            'agent.gate.exclusion_hint',
            '下列高危操作即使开启完全信任，仍会征求你的确认，且无法加入始终允许。可增删。'
          )}
        </Text>
        {exclusionList.map((action) => (
          <View key={action} style={styles.exclusionRow}>
            <Text style={[styles.exclusionItem, { color: colors.textSecondary, flex: 1 }]}>
              {action}
            </Text>
            <TouchableOpacity onPress={() => removeExclusion(action)} hitSlop={8}>
              <Text style={{ color: colors.error, fontSize: 13, fontWeight: '600' }}>
                {t('common.remove', '移除')}
              </Text>
            </TouchableOpacity>
          </View>
        ))}
        <View style={styles.addRow}>
          <TextInput
            value={exclusionDraft}
            onChangeText={setExclusionDraft}
            placeholder="action"
            placeholderTextColor={colors.textTertiary}
            style={[
              styles.input,
              { flex: 1, color: colors.textPrimary, borderColor: colors.borderSubtle }
            ]}
          />
          <TouchableOpacity onPress={addExclusion} hitSlop={8}>
            <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '700' }}>
              {t('common.add', '添加')}
            </Text>
          </TouchableOpacity>
        </View>
      </SettingsGroupCard>
    </View>
  )
}

const styles = StyleSheet.create({
  section: {
    gap: 12
  },
  groupTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4
  },
  rowDivider: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth
  },
  rowText: {
    flex: 1,
    gap: 4
  },
  label: {
    fontSize: 15,
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
  allowlistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  allowlistText: {
    flex: 1,
    gap: 2,
    paddingRight: 12
  },
  allowlistAction: {
    fontSize: 14,
    fontWeight: '600'
  },
  allowlistMeta: {
    fontSize: 11
  },
  exclusionItem: {
    fontSize: 13,
    fontWeight: '500',
    paddingVertical: 4
  },
  exclusionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    marginTop: 8
  }
})
