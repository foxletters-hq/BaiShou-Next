import React from 'react'
import { View, Text, Pressable, Modal } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import { Input } from '../Input/Input'
import { Button } from '../Button'

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
  const { colors, tokens } = useNativeTheme()

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          alignItems: 'center'
        }}
        onPress={onClose}
      >
        <Pressable
          style={{
            width: '85%',
            backgroundColor: colors.bgSurface,
            borderRadius: tokens.radius.xl,
            padding: tokens.spacing.lg
          }}
          onPress={(e) => e.stopPropagation()}
        >
          <Text
            style={{
              fontSize: 18,
              fontWeight: '600',
              color: colors.textPrimary,
              marginBottom: tokens.spacing.md
            }}
          >
            {editingKey
              ? t('settings.edit_identity_entry', '编辑条目')
              : t('settings.add_identity_entry', '添加条目')}
          </Text>

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
            containerStyle={{ marginBottom: tokens.spacing.lg }}
          />

          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'flex-end',
              gap: tokens.spacing.sm
            }}
          >
            <Button variant="outline" onPress={onClose}>
              {t('common.cancel', '取消')}
            </Button>
            <Button variant="primary" onPress={onSave}>
              {t('common.save', '保存')}
            </Button>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}
