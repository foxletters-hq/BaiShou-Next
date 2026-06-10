import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native'
import { useTranslation } from 'react-i18next'
import {
  DEFAULT_DIARY_APPEND_BLOCK_TEMPLATE,
  DEFAULT_DIARY_NEW_ENTRY_TEMPLATE
} from '@baishou/shared'
import { useNativeTheme, useNativeToast, Input } from '@baishou/ui/native'
import { useDiaryTemplateConfig } from '../../../hooks/useDiaryTemplateConfig'
import { SettingsGroupCard } from './SettingsGroupCard'

export const DiaryTemplateSettingsSection: React.FC = () => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const toast = useNativeToast()
  const { config, hydrated, saving, persist, persistMerge } = useDiaryTemplateConfig()

  const [localNewEntry, setLocalNewEntry] = useState('')
  const [localAppendBlock, setLocalAppendBlock] = useState('')
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (!hydrated || dirty) return
    setLocalNewEntry(config.newEntryTemplate?.trim() || DEFAULT_DIARY_NEW_ENTRY_TEMPLATE)
    setLocalAppendBlock(config.appendBlockTemplate?.trim() || DEFAULT_DIARY_APPEND_BLOCK_TEMPLATE)
  }, [hydrated, config.newEntryTemplate, config.appendBlockTemplate, dirty])

  const handleSave = async () => {
    try {
      const next = await persistMerge({
        newEntryTemplate: localNewEntry.trim(),
        appendBlockTemplate: localAppendBlock.trim()
      })
      setLocalNewEntry(next.newEntryTemplate?.trim() || DEFAULT_DIARY_NEW_ENTRY_TEMPLATE)
      setLocalAppendBlock(next.appendBlockTemplate?.trim() || DEFAULT_DIARY_APPEND_BLOCK_TEMPLATE)
      setDirty(false)
      toast.showSuccess(t('settings.saved'))
    } catch {
      toast.showError(t('common.errors.save_failed', '保存失败'))
    }
  }

  const handleReset = async () => {
    try {
      await persist({})
      setLocalNewEntry(DEFAULT_DIARY_NEW_ENTRY_TEMPLATE)
      setLocalAppendBlock(DEFAULT_DIARY_APPEND_BLOCK_TEMPLATE)
      setDirty(false)
      toast.showSuccess(t('summary.reset_template_success'))
    } catch {
      toast.showError(t('common.errors.save_failed', '保存失败'))
    }
  }

  const canSave = hydrated && dirty && !saving

  return (
    <>
      <SettingsGroupCard>
        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
          {t('settings.diary_template_new_entry', '新建日记模板')}
        </Text>
        <Text style={[styles.desc, { color: colors.textSecondary }]}>
          {t(
            'settings.diary_template_new_entry_desc',
            '创建新日记时自动填入的正文开头，可用变量见下方说明。'
          )}
        </Text>
        {!hydrated ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : (
          <Input
            value={localNewEntry}
            onChangeText={(text) => {
              setLocalNewEntry(text)
              setDirty(true)
            }}
            multiline
            textarea
            numberOfLines={6}
            placeholder={DEFAULT_DIARY_NEW_ENTRY_TEMPLATE}
            style={{ minHeight: 120, lineHeight: 20 }}
            containerStyle={{ marginBottom: 8 }}
            editable={!saving}
          />
        )}
      </SettingsGroupCard>

      <SettingsGroupCard>
        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
          {t('settings.diary_template_append', '追加记录模板')}
        </Text>
        <Text style={[styles.desc, { color: colors.textSecondary }]}>
          {t('settings.diary_template_append_desc', '在已有日记末尾追加新记录时插入的时间块。')}
        </Text>
        {!hydrated ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : (
          <Input
            value={localAppendBlock}
            onChangeText={(text) => {
              setLocalAppendBlock(text)
              setDirty(true)
            }}
            multiline
            textarea
            numberOfLines={6}
            placeholder={DEFAULT_DIARY_APPEND_BLOCK_TEMPLATE}
            style={{ minHeight: 120, lineHeight: 20 }}
            containerStyle={{ marginBottom: 8 }}
            editable={!saving}
          />
        )}
      </SettingsGroupCard>

      <SettingsGroupCard>
        <Text style={[styles.varsHint, { color: colors.textSecondary }]}>
          {t(
            'settings.diary_template_vars_hint',
            '可用变量：{time} 当前时间 (HH:mm:ss)，{date} 日期 (yyyy-MM-dd)，{datetime} 完整日期时间'
          )}
        </Text>

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
    </>
  )
}

const styles = StyleSheet.create({
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6
  },
  desc: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12
  },
  loadingRow: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center'
  },
  varsHint: {
    fontSize: 12,
    lineHeight: 18
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16
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
