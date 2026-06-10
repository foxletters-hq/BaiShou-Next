import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native'
import { useTranslation } from 'react-i18next'
import { DEFAULT_DIARY_AI_WRITING_PROMPT } from '@baishou/shared'
import { useNativeTheme, useNativeToast, Input } from '@baishou/ui/native'
import { useDiaryTemplateConfig } from '../../../hooks/useDiaryTemplateConfig'
import { SettingsGroupCard } from './SettingsGroupCard'

function resolvePromptForEdit(configValue: string | undefined): string {
  const trimmed = configValue?.trim()
  return trimmed || DEFAULT_DIARY_AI_WRITING_PROMPT
}

export const DiaryAiWritingSettingsSection: React.FC = () => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const toast = useNativeToast()
  const { config, hydrated, saving, persist, persistMerge, reload } = useDiaryTemplateConfig()
  const [localPrompt, setLocalPrompt] = useState('')
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (!hydrated || dirty) return
    setLocalPrompt(resolvePromptForEdit(config.aiWritingPrompt))
  }, [hydrated, config.aiWritingPrompt, dirty])

  const handleSave = async () => {
    try {
      const trimmed = localPrompt.trim()
      const saved = config.aiWritingPrompt?.trim()
      const isDefault = trimmed === DEFAULT_DIARY_AI_WRITING_PROMPT.trim()
      const next =
        isDefault && !saved
          ? await persistMerge({ aiWritingPrompt: undefined })
          : await persistMerge({ aiWritingPrompt: trimmed })
      setLocalPrompt(resolvePromptForEdit(next.aiWritingPrompt))
      setDirty(false)
      toast.showSuccess(t('settings.saved'))
    } catch {
      toast.showError(t('common.errors.save_failed', '保存失败'))
    }
  }

  const handleReset = async () => {
    try {
      const latest = await reload()
      const { aiWritingPrompt: _removed, ...rest } = latest
      const next = await persist(rest)
      setLocalPrompt(DEFAULT_DIARY_AI_WRITING_PROMPT)
      setDirty(false)
      toast.showSuccess(t('summary.reset_template_success'))
    } catch {
      toast.showError(t('common.errors.save_failed', '保存失败'))
    }
  }

  const canSave = hydrated && dirty && !saving

  return (
    <SettingsGroupCard>
      <Text style={[styles.desc, { color: colors.textSecondary }]}>
        {t(
          'settings.diary_partner_writing_desc',
          '定义伙伴在为用户记录日记时应遵守的格式与书写规范。'
        )}
      </Text>
      <Text style={[styles.injectHint, { color: colors.textTertiary }]}>
        {t(
          'settings.diary_partner_writing_inject_hint',
          '此提示词仅在伙伴使用「写日记」「编辑日记」工具时注入，不会出现在普通对话中。'
        )}
      </Text>
      {!hydrated ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textTertiary }]}>
            {t('common.loading', '加载中…')}
          </Text>
        </View>
      ) : (
        <Input
          value={localPrompt}
          onChangeText={(text) => {
            setLocalPrompt(text)
            setDirty(true)
          }}
          multiline
          textarea
          numberOfLines={12}
          placeholder={DEFAULT_DIARY_AI_WRITING_PROMPT}
          style={{ minHeight: 200, lineHeight: 20 }}
          containerStyle={{ marginBottom: 8 }}
          editable={!saving}
        />
      )}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.btn, { borderColor: colors.borderSubtle, opacity: saving ? 0.5 : 1 }]}
          onPress={() => void handleReset()}
          disabled={!hydrated || saving}
        >
          <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>
            {t('common.reset', '重置')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.btn,
            styles.btnPrimary,
            { backgroundColor: colors.primary, opacity: canSave ? 1 : 0.5 }
          ]}
          onPress={() => void handleSave()}
          disabled={!canSave}
        >
          <Text style={{ color: colors.textOnPrimary, fontWeight: '600' }}>
            {saving ? t('common.saving', '保存中…') : t('common.save', '保存')}
          </Text>
        </TouchableOpacity>
      </View>
    </SettingsGroupCard>
  )
}

const styles = StyleSheet.create({
  desc: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 8
  },
  injectHint: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 12
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 200,
    justifyContent: 'center'
  },
  loadingText: {
    fontSize: 13
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 8
  },
  btn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth
  },
  btnPrimary: {
    borderWidth: 0
  }
})
