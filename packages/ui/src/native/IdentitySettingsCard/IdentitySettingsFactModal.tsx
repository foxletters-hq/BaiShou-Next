import React from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { sharedTokens } from '../../theme/tokens'
import { useNativeTheme } from '../theme'
import { Input } from '../Input/Input'
import { Button } from '../Button'
import { Modal, modalActionsStyle } from '../Modal/Modal'

export interface IdentitySettingsFactModalProps {
  visible: boolean
  editingKey: string | null
  editKeyInput: string
  editValInput: string
  onEditKeyChange: (text: string) => void
  onEditValChange: (text: string) => void
  onClose: () => void
  onSave: () => void
}

export const IdentitySettingsFactModal: React.FC<IdentitySettingsFactModalProps> = ({
  visible,
  editingKey,
  editKeyInput,
  editValInput,
  onEditKeyChange,
  onEditValChange,
  onClose,
  onSave
}) => {
  const { t } = useTranslation()
  const { tokens } = useNativeTheme()

  return (
    <Modal
      visible={visible}
      title={
        editingKey
          ? t('settings.edit_identity_entry', '编辑条目')
          : t('settings.add_identity_entry', '添加条目')
      }
      onClose={onClose}
      avoidKeyboard
    >
      <ScrollView
        style={styles.formScroll}
        contentContainerStyle={styles.formScrollContent}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
      >
        <Input
          label={t('settings.identity_key', '标签')}
          value={editKeyInput}
          onChangeText={onEditKeyChange}
          placeholder={t('settings.identity_key_hint', '如：生日、职业')}
          containerStyle={{ marginBottom: tokens.spacing.md }}
        />

        <Input
          label={t('settings.identity_value', '内容')}
          value={editValInput}
          onChangeText={onEditValChange}
          placeholder={t('settings.identity_value_hint', '如：2000-05-20')}
          multiline
          textarea
          nestedScrollEnabled
          containerStyle={{ marginBottom: tokens.spacing.xs }}
          style={styles.valueInput}
        />
      </ScrollView>

      <View style={modalActionsStyle}>
        <Button size="sm" variant="outline" onPress={onClose}>
          {t('common.cancel', '取消')}
        </Button>
        <Button size="sm" variant="primary" onPress={onSave}>
          {t('common.save', '保存')}
        </Button>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  formScroll: {
    flexGrow: 0,
    flexShrink: 1
  },
  formScrollContent: {
    paddingRight: sharedTokens.spacing.mdTight
  },
  valueInput: {
    minHeight: sharedTokens.spacing.xxxl * 2,
    maxHeight: sharedTokens.spacing.xxxl * 3 + sharedTokens.spacing.xl,
    textAlignVertical: 'top'
  }
})
