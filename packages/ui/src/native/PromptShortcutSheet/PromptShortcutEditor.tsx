import React from 'react'
import { View, Text, Pressable, ScrollView } from 'react-native'
import type { PromptShortcut } from '@baishou/shared'
import { useTranslation } from 'react-i18next'
import { Input } from '../Input/Input'
import { promptShortcutSheetStyles as styles } from './prompt-shortcut-sheet.styles'

export function PromptShortcutEditor(props: {
  editingItem: PromptShortcut
  draftName: string
  draftContent: string
  saving: boolean
  colors: {
    textPrimary: string
    textSecondary: string
    textOnPrimary: string
    borderControl: string
    primary: string
  }
  onChangeName: (value: string) => void
  onChangeContent: (value: string) => void
  onCancel: () => void
  onSave: () => void
}) {
  const { t } = useTranslation()
  const { editingItem, colors } = props

  return (
    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text style={[styles.headerText, { color: colors.textPrimary }]}>
          {editingItem.id === 'new'
            ? t('shortcut.add_custom_command', '新增自定义指令')
            : t('shortcut.edit', '编辑')}
        </Text>
        <Pressable onPress={props.onCancel} hitSlop={12}>
          <Text style={[styles.closeIcon, { color: colors.textSecondary }]}>×</Text>
        </Pressable>
      </View>

      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
        {t('shortcut.label_name', '指令名称')}
      </Text>
      <Input
        value={props.draftName}
        onChangeText={props.onChangeName}
        placeholder={t('shortcut.label_hint', '例如：翻译')}
        style={styles.fieldInput}
      />

      <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 12 }]}>
        {t('shortcut.content_prompt', '对应内容')}
      </Text>
      <Input
        value={props.draftContent}
        onChangeText={props.onChangeContent}
        placeholder={t('shortcut.content_hint', '请帮我翻译下面这段文本。')}
        multiline
        textarea
        style={[styles.fieldInput, styles.fieldTextArea]}
      />

      <View style={styles.formActions}>
        <Pressable
          style={[styles.formBtn, { borderColor: colors.borderControl }]}
          onPress={props.onCancel}
        >
          <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>
            {t('common.cancel', '取消')}
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.formBtn,
            styles.formBtnPrimary,
            {
              backgroundColor: colors.primary,
              opacity: !props.draftContent.trim() || props.saving ? 0.5 : 1
            }
          ]}
          disabled={!props.draftContent.trim() || props.saving}
          onPress={props.onSave}
        >
          <Text style={{ color: colors.textOnPrimary, fontWeight: '600' }}>
            {t('common.save', '保存')}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  )
}
