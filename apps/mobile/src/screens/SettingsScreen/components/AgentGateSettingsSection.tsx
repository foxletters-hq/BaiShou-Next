import React, { useCallback, useEffect, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, LayoutAnimation } from 'react-native'
import { useTranslation } from 'react-i18next'
import {
  AgentGateTrustMode,
  BAISHOU_AGENT_GATE_CONFIG_KEY,
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
  }
})
