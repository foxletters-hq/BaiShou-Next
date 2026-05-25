import React, { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '@baishou/ui/native'
import { logger } from '@baishou/shared'
import { useBaishou } from '../../../providers/BaishouProvider'
import type { AgentBehaviorConfig } from '@baishou/shared'
import { DEFAULT_AGENT_BEHAVIOR } from '@baishou/database'

export const AgentBehaviorSection: React.FC = () => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const { services, dbReady } = useBaishou()

  const [config, setConfig] = useState<AgentBehaviorConfig>(DEFAULT_AGENT_BEHAVIOR)
  const [dirty, setDirty] = useState(false)

  // 编辑中的文本状态，用于解决清空输入框时 state 与显示不同步的问题
  const [editingContextWindowSize, setEditingContextWindowSize] = useState('')
  const [editingCompressTokens, setEditingCompressTokens] = useState('')
  const [editingTruncateTokens, setEditingTruncateTokens] = useState('')
  const [isEditingContextWindowSize, setIsEditingContextWindowSize] = useState(false)
  const [isEditingCompressTokens, setIsEditingCompressTokens] = useState(false)
  const [isEditingTruncateTokens, setIsEditingTruncateTokens] = useState(false)

  useEffect(() => {
    if (!dbReady || !services) return
    const loadConfig = async () => {
      try {
        const saved = await services.settingsManager.get<AgentBehaviorConfig>('agent_behavior')
        if (saved) {
          const merged = { ...DEFAULT_AGENT_BEHAVIOR, ...saved }
          setConfig(merged)
          // 初始化编辑状态
          setEditingContextWindowSize(String(merged.agentContextWindowSize))
          setEditingCompressTokens(String(merged.companionCompressTokens))
          setEditingTruncateTokens(String(merged.companionTruncateTokens))
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
      Alert.alert(t('common.success', '成功'), t('settings.agent_behavior_saved', 'Agent 行为配置已保存'))
    } catch (e) {
      Alert.alert(t('common.error', '错误'), t('settings.save_failed', '保存失败'))
    }
  }, [services, dbReady, config, t])

  const updateConfig = useCallback(
    (partial: Partial<AgentBehaviorConfig>) => {
      setConfig((prev) => ({ ...prev, ...partial }))
      setDirty(true)
    },
    []
  )

  const handleResetDefaults = useCallback(() => {
    Alert.alert(
      t('settings.reset_defaults_title', '恢复默认'),
      t('settings.reset_defaults_confirm', '确定恢复所有 Agent 行为配置为默认值吗？'),
      [
        { text: t('common.cancel', '取消'), style: 'cancel' },
        {
          text: t('common.confirm', '确定'),
          onPress: () => {
            setConfig(DEFAULT_AGENT_BEHAVIOR)
            setDirty(true)
          }
        }
      ]
    )
  }, [t])

  const handlePinnedIdsChange = useCallback((text: string) => {
    const ids = text
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 3) // 限制最多 3 个
    updateConfig({ pinnedAssistantIds: ids })
  }, [updateConfig])

  return (
    <View style={styles.section}>
      {/* 上下文窗口大小 */}
      <View style={[styles.card, { backgroundColor: colors.bgSurfaceHighest }]}>
        <Text style={[styles.label, { color: colors.textPrimary }]}>
          {t('settings.context_window_size', 'Agent 上下文窗口大小')}
        </Text>
        <Text style={[styles.hint, { color: colors.textTertiary }]}>
          {t('settings.context_window_size_hint', '每次对话携带的历史消息条数（默认 20）')}
        </Text>
        <TextInput
          style={[
            styles.numberInput,
            {
              backgroundColor: colors.bgSurface,
              color: colors.textPrimary,
              borderColor: colors.borderSubtle
            }
          ]}
          value={isEditingContextWindowSize ? editingContextWindowSize : String(config.agentContextWindowSize)}
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
              // 恢复原值
              setEditingContextWindowSize(String(config.agentContextWindowSize))
            }
          }}
          keyboardType="number-pad"
          placeholder="20"
          placeholderTextColor={colors.textTertiary}
        />
      </View>

      {/* 伙伴压缩 Token 阈值 */}
      <View style={[styles.card, { backgroundColor: colors.bgSurfaceHighest }]}>
        <Text style={[styles.label, { color: colors.textPrimary }]}>
          {t('settings.compress_token_threshold', '伙伴压缩 Token 阈值')}
        </Text>
        <Text style={[styles.hint, { color: colors.textTertiary }]}>
          {t(
            'settings.compress_token_threshold_hint',
            '深度陪伴模式触发压缩的 Token 数（默认 8000）'
          )}
        </Text>
        <TextInput
          style={[
            styles.numberInput,
            {
              backgroundColor: colors.bgSurface,
              color: colors.textPrimary,
              borderColor: colors.borderSubtle
            }
          ]}
          value={isEditingCompressTokens ? editingCompressTokens : String(config.companionCompressTokens)}
          onChangeText={(text) => {
            setEditingCompressTokens(text)
            setIsEditingCompressTokens(true)
          }}
          onFocus={() => {
            setEditingCompressTokens(String(config.companionCompressTokens))
            setIsEditingCompressTokens(true)
          }}
          onBlur={() => {
            setIsEditingCompressTokens(false)
            const num = parseInt(editingCompressTokens, 10)
            if (!isNaN(num) && num > 0) {
              updateConfig({ companionCompressTokens: num })
            } else {
              // 恢复原值
              setEditingCompressTokens(String(config.companionCompressTokens))
            }
          }}
          keyboardType="number-pad"
          placeholder="8000"
          placeholderTextColor={colors.textTertiary}
        />
      </View>

      {/* 伙伴截断 Token 阈值 */}
      <View style={[styles.card, { backgroundColor: colors.bgSurfaceHighest }]}>
        <Text style={[styles.label, { color: colors.textPrimary }]}>
          {t('settings.truncate_token_threshold', '伙伴截断 Token 阈值')}
        </Text>
        <Text style={[styles.hint, { color: colors.textTertiary }]}>
          {t(
            'settings.truncate_token_threshold_hint',
            '压缩时截断多少 Token 以前的对话（默认 4000）'
          )}
        </Text>
        <TextInput
          style={[
            styles.numberInput,
            {
              backgroundColor: colors.bgSurface,
              color: colors.textPrimary,
              borderColor: colors.borderSubtle
            }
          ]}
          value={isEditingTruncateTokens ? editingTruncateTokens : String(config.companionTruncateTokens)}
          onChangeText={(text) => {
            setEditingTruncateTokens(text)
            setIsEditingTruncateTokens(true)
          }}
          onFocus={() => {
            setEditingTruncateTokens(String(config.companionTruncateTokens))
            setIsEditingTruncateTokens(true)
          }}
          onBlur={() => {
            setIsEditingTruncateTokens(false)
            const num = parseInt(editingTruncateTokens, 10)
            if (!isNaN(num) && num > 0) {
              updateConfig({ companionTruncateTokens: num })
            } else {
              // 恢复原值
              setEditingTruncateTokens(String(config.companionTruncateTokens))
            }
          }}
          keyboardType="number-pad"
          placeholder="4000"
          placeholderTextColor={colors.textTertiary}
        />
      </View>

      {/* Agent 人格设定 */}
      <View style={[styles.card, { backgroundColor: colors.bgSurfaceHighest }]}>
        <Text style={[styles.label, { color: colors.textPrimary }]}>
          {t('settings.agent_persona', 'Agent 人格设定')}
        </Text>
        <Text style={[styles.hint, { color: colors.textTertiary }]}>
          {t('settings.agent_persona_hint', '描述 Agent 的角色身份与性格特征')}
        </Text>
        <TextInput
          style={[
            styles.textArea,
            {
              backgroundColor: colors.bgSurface,
              color: colors.textPrimary,
              borderColor: colors.borderSubtle
            }
          ]}
          value={config.agentPersona}
          onChangeText={(text) => updateConfig({ agentPersona: text })}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          placeholder={t(
            'settings.agent_persona_placeholder',
            '例如：你是 AI 伙伴，帮助用户回顾日记和生活记录。'
          )}
          placeholderTextColor={colors.textTertiary}
        />
      </View>

      {/* Agent 指导方针 */}
      <View style={[styles.card, { backgroundColor: colors.bgSurfaceHighest }]}>
        <Text style={[styles.label, { color: colors.textPrimary }]}>
          {t('settings.agent_guidelines', 'Agent 指导方针')}
        </Text>
        <Text style={[styles.hint, { color: colors.textTertiary }]}>
          {t('settings.agent_guidelines_hint', 'Agent 在对话中应遵循的行为准则')}
        </Text>
        <TextInput
          style={[
            styles.textArea,
            {
              backgroundColor: colors.bgSurface,
              color: colors.textPrimary,
              borderColor: colors.borderSubtle
            }
          ]}
          value={config.agentGuidelines}
          onChangeText={(text) => updateConfig({ agentGuidelines: text })}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          placeholder={t(
            'settings.agent_guidelines_placeholder',
            '例如：请使用工具查阅日记内容，不要编造。引用时注明日期。'
          )}
          placeholderTextColor={colors.textTertiary}
        />
      </View>

      {/* 置顶助手 ID 列表 */}
      <View style={[styles.card, { backgroundColor: colors.bgSurfaceHighest }]}>
        <Text style={[styles.label, { color: colors.textPrimary }]}>
          {t('settings.pinned_assistant_ids', '置顶助手 ID 列表')}
        </Text>
        <Text style={[styles.hint, { color: colors.textTertiary }]}>
          {t('settings.pinned_assistant_ids_hint', '用逗号分隔多个助手 ID（最多 3 个）')}
        </Text>
        <TextInput
          style={[
            styles.textInput,
            {
              backgroundColor: colors.bgSurface,
              color: colors.textPrimary,
              borderColor: colors.borderSubtle
            }
          ]}
          value={config.pinnedAssistantIds.join(', ')}
          onChangeText={handlePinnedIdsChange}
          placeholder={t('settings.pinned_assistant_ids_placeholder', '例如：assistant-1, assistant-2')}
          placeholderTextColor={colors.textTertiary}
        />
      </View>

      {/* 操作按钮 */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.button, styles.resetButton, { borderColor: colors.borderSubtle }]}
          onPress={handleResetDefaults}
        >
          <Text style={[styles.buttonText, { color: colors.textSecondary }]}>
            {t('settings.reset_defaults', '恢复默认')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.button,
            styles.saveButton,
            { backgroundColor: dirty ? colors.primary : colors.borderMuted }
          ]}
          onPress={handleSave}
          disabled={!dirty}
        >
          <Text style={[styles.buttonText, { color: colors.textOnPrimary }]}>
            {t('common.save', '保存')}
          </Text>
        </TouchableOpacity>
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
  numberInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    fontWeight: '500'
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 100,
    lineHeight: 20
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center'
  },
  resetButton: {
    borderWidth: 1
  },
  saveButton: {},
  buttonText: {
    fontSize: 15,
    fontWeight: '600'
  }
})
