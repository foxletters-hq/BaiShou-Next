import React from 'react'
import { View, Text, Pressable, ScrollView } from 'react-native'
import type { PromptShortcut } from '@baishou/shared'
import { useTranslation } from 'react-i18next'
import { Button } from '../Button'
import { Input } from '../Input/Input'
import { promptShortcutSheetStyles as styles } from './prompt-shortcut-sheet.styles'
import { sharedTokens } from '../../theme/tokens'

export function PromptShortcutEditor(props: {
  editingItem: PromptShortcut
  draftCommand: string
  draftDescription: string
  draftContent: string
  saving: boolean
  colors: {
    textPrimary: string
    textSecondary: string
    textOnPrimary: string
    borderControl: string
    primary: string
  }
  onChangeCommand: (value: string) => void
  onChangeDescription: (value: string) => void
  onChangeContent: (value: string) => void
  onCancel: () => void
  onSave: () => void
}) {
  const { t } = useTranslation()
  const { editingItem, colors } = props

  return (
    <View style={styles.editorRoot}>
      <ScrollView
        style={styles.editorScroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.editorScrollContent}
      >
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

        <View style={styles.fieldBlock}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
            {t('shortcut.command_label', 'Skill 名称 (用于 / 触发)')}
          </Text>
          <Input
            value={props.draftCommand}
            onChangeText={props.onChangeCommand}
            placeholder={t('shortcut.command_hint', '例如: review, translate')}
            containerStyle={styles.fieldControl}
          />
        </View>

        <View style={[styles.fieldBlock, { marginTop: sharedTokens.spacing.mdTight }]}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
            {t('shortcut.description_label', '说明')}
          </Text>
          <Input
            value={props.draftDescription}
            onChangeText={props.onChangeDescription}
            placeholder={t('shortcut.label_hint', '例如：翻译')}
            containerStyle={styles.fieldControl}
          />
        </View>

        <View style={[styles.fieldBlock, { marginTop: sharedTokens.spacing.mdTight }]}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
            {t('shortcut.content_prompt', 'Skill 正文')}
          </Text>
          <Input
            value={props.draftContent}
            onChangeText={props.onChangeContent}
            placeholder={t('shortcut.content_hint', '请帮我翻译下面这段文本。')}
            multiline
            textarea
            containerStyle={styles.fieldControl}
            style={styles.fieldTextArea}
          />
        </View>
      </ScrollView>

      <View style={styles.formActions}>
        <Button size="sm" onPress={props.onCancel}>
          {t('common.cancel', '取消')}
        </Button>
        <Button
          size="sm"
          isDisabled={!props.draftContent.trim() || props.saving}
          onPress={props.onSave}
        >
          {t('common.save', '保存')}
        </Button>
      </View>
    </View>
  )
}
