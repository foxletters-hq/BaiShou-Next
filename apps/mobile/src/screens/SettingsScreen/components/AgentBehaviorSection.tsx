import React, { useEffect, useState, useCallback } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme, useNativeToast, useDialog, Input, Button } from '@baishou/ui/native'
import { useBaishou } from '../../../providers/BaishouProvider'
import type { AgentBehaviorConfig } from '@baishou/shared'
import { DEFAULT_AGENT_BEHAVIOR } from '@baishou/database'

export const AgentBehaviorSection: React.FC = () => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const toast = useNativeToast()
  const dialog = useDialog()
  const { services, dbReady } = useBaishou()

  const [config, setConfig] = useState<AgentBehaviorConfig>(DEFAULT_AGENT_BEHAVIOR)
  const [dirty, setDirty] = useState(false)

  const [editingContextWindowSize, setEditingContextWindowSize] = useState('')
  const [isEditingContextWindowSize, setIsEditingContextWindowSize] = useState(false)

  useEffect(() => {
    if (!dbReady || !services) return
    const loadConfig = async () => {
      try {
        const saved = await services.settingsManager.get<AgentBehaviorConfig>('agent_behavior')
        if (saved) {
          const merged = { ...DEFAULT_AGENT_BEHAVIOR, ...saved }
          setConfig(merged)
          setEditingContextWindowSize(String(merged.agentContextWindowSize))
        }
      } catch (e) {
        console.warn('加载 Agent 行为配置失败', e)
      }
    }
    loadConfig()
  }, [dbReady, services])

  const handleSave = useCallback(async () => {
    if (!services || !dbReady) return
    try {
      await services.settingsManager.set('agent_behavior', config)
      setDirty(false)
      toast.showSuccess(t('settings.agent_behavior_saved'))
    } catch (e) {
      toast.showError(t('common.errors.save_failed'))
    }
  }, [services, dbReady, config, t, toast])

  const updateConfig = useCallback((partial: Partial<AgentBehaviorConfig>) => {
    setConfig((prev) => ({ ...prev, ...partial }))
    setDirty(true)
  }, [])

  const handleResetDefaults = useCallback(async () => {
    const confirmed = await dialog.confirm(t('settings.reset_defaults_confirm'), {
      title: t('settings.reset_defaults_title')
    })
    if (!confirmed) return
    setConfig(DEFAULT_AGENT_BEHAVIOR)
    setDirty(true)
  }, [dialog, t])

  const handlePinnedIdsChange = useCallback(
    (text: string) => {
      const ids = text
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 3)
      updateConfig({ pinnedAssistantIds: ids })
    },
    [updateConfig]
  )

  return (
    <View style={styles.section}>
      <View style={[styles.card, { backgroundColor: colors.bgSurfaceHighest }]}>
        <Text style={[styles.label, { color: colors.textPrimary }]}>
          {t('settings.context_window_size')}
        </Text>
        <Text style={[styles.hint, { color: colors.textTertiary }]}>
          {t('settings.context_window_size_hint')}
        </Text>
        <Input
          value={
            isEditingContextWindowSize
              ? editingContextWindowSize
              : String(config.agentContextWindowSize)
          }
          onChangeText={(text) => {
            setEditingContextWindowSize(text)
            setIsEditingContextWindowSize(true)
          }}
          onFocus={() => {
            setEditingContextWindowSize(String(config.agentContextWindowSize))
            setIsEditingContextWindowSize(true)
          }}
          onBlur={() => {
            setIsEditingContextWindowSize(false)
            const num = parseInt(editingContextWindowSize, 10)
            if (!isNaN(num) && num > 0) {
              updateConfig({ agentContextWindowSize: num })
            } else {
              setEditingContextWindowSize(String(config.agentContextWindowSize))
            }
          }}
          keyboardType="number-pad"
          placeholder="20"
        />
      </View>

      <View style={[styles.card, { backgroundColor: colors.bgSurfaceHighest }]}>
        <Text style={[styles.hint, { color: colors.textTertiary, marginBottom: 0 }]}>
          {t(
            'settings.compression_threshold_in_assistant_hint',
            '对话压缩 Token 阈值请在「伙伴编辑 → 记忆」中按伙伴单独配置，不在此全局设置。'
          )}
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: colors.bgSurfaceHighest }]}>
        <Text style={[styles.label, { color: colors.textPrimary }]}>
          {t('settings.agent_persona')}
        </Text>
        <Text style={[styles.hint, { color: colors.textTertiary }]}>
          {t('settings.agent_persona_hint')}
        </Text>
        <Input
          value={config.agentPersona}
          onChangeText={(text) => updateConfig({ agentPersona: text })}
          multiline
          textarea
          numberOfLines={4}
          placeholder={t('settings.agent_persona_placeholder')}
        />
      </View>

      <View style={[styles.card, { backgroundColor: colors.bgSurfaceHighest }]}>
        <Text style={[styles.label, { color: colors.textPrimary }]}>
          {t('settings.agent_guidelines')}
        </Text>
        <Text style={[styles.hint, { color: colors.textTertiary }]}>
          {t('settings.agent_guidelines_hint')}
        </Text>
        <Input
          value={config.agentGuidelines}
          onChangeText={(text) => updateConfig({ agentGuidelines: text })}
          multiline
          textarea
          numberOfLines={4}
          placeholder={t('settings.agent_guidelines_placeholder')}
        />
      </View>

      <View style={[styles.card, { backgroundColor: colors.bgSurfaceHighest }]}>
        <Text style={[styles.label, { color: colors.textPrimary }]}>
          {t('settings.pinned_assistant_ids')}
        </Text>
        <Text style={[styles.hint, { color: colors.textTertiary }]}>
          {t('settings.pinned_assistant_ids_hint')}
        </Text>
        <Input
          value={config.pinnedAssistantIds.join(', ')}
          onChangeText={handlePinnedIdsChange}
          placeholder={t('settings.pinned_assistant_ids_placeholder')}
        />
      </View>

      <View style={styles.actions}>
        <Button variant="outline" className="flex-1" onPress={handleResetDefaults}>
          {t('settings.reset_defaults')}
        </Button>
        <Button variant="primary" className="flex-1" onPress={handleSave} isDisabled={!dirty}>
          {t('common.save')}
        </Button>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 24
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4
  },
  hint: {
    fontSize: 12,
    marginBottom: 10,
    lineHeight: 18
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8
  }
})
