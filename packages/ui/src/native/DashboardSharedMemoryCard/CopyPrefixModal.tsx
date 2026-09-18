import { useTranslation } from 'react-i18next'
import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  KeyboardAvoidingView,
  Platform
} from 'react-native'
import { useNativeTheme } from '../../native/theme'
import { Input } from '../Input/Input'

export function CopyPrefixModal({
  visible,
  initialValue,
  onCancel,
  onConfirm
}: {
  visible: boolean
  initialValue: string
  onCancel: () => void
  onConfirm: (value: string) => void
}) {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const [value, setValue] = useState(initialValue)

  useEffect(() => {
    if (visible) setValue(initialValue)
  }, [visible, initialValue])

  if (!visible) return null

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        style={[prefixModalStyles.overlay, { backgroundColor: colors.overlay }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <View
          style={[
            prefixModalStyles.card,
            {
              backgroundColor: colors.bgSurface,
              borderRadius: tokens.radius.xl,
              padding: tokens.spacing.lg
            }
          ]}
        >
          <Text style={[prefixModalStyles.title, { color: colors.textPrimary }]}>
            {t('summary.copy_prefix_label', '拷贝前缀')}
          </Text>
          <Text style={[prefixModalStyles.message, { color: colors.textSecondary }]}>
            {t(
              'summary.copy_prefix_hint',
              '会自动附加在拷贝内容的最前方（例如：Hi，这是我的回忆...）'
            )}
          </Text>
          <Input
            value={value}
            onChangeText={setValue}
            multiline
            textarea
            autoFocus
            containerStyle={{ marginBottom: 16 }}
            style={{ minHeight: 100 }}
          />
          <View style={prefixModalStyles.actions}>
            <Pressable onPress={onCancel} style={prefixModalStyles.actionBtn}>
              <Text style={{ color: colors.textSecondary }}>{t('common.cancel', '取消')}</Text>
            </Pressable>
            <Pressable onPress={() => onConfirm(value)} style={prefixModalStyles.actionBtn}>
              <Text style={{ color: colors.primary, fontWeight: '600' }}>
                {t('common.confirm', '确定')}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const prefixModalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 24
  },
  card: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center'
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 20
  },
  actionBtn: {
    paddingVertical: 8,
    paddingHorizontal: 4
  }
})
