import React from 'react'
import { Modal, View, Text, ActivityIndicator, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'

export interface RestoreBlockingOverlayProps {
  visible: boolean
  message?: string
  hint?: string
}

export const RestoreBlockingOverlay: React.FC<RestoreBlockingOverlayProps> = ({
  visible,
  message,
  hint
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const resolvedMessage = message ?? t('settings.restoring_data', '正在恢复数据...')
  const resolvedHint =
    hint ?? t('settings.restoring_data_hint', '请勿关闭应用或进行其他操作')

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={[styles.overlay, { backgroundColor: colors.overlay || 'rgba(0,0,0,0.55)' }]}>
        <View
          style={[
            styles.panel,
            {
              backgroundColor: colors.bgSurface,
              borderColor: colors.borderSubtle
            }
          ]}
        >
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.message, { color: colors.textPrimary }]}>{resolvedMessage}</Text>
          {resolvedHint ? (
            <Text style={[styles.hint, { color: colors.textSecondary }]}>{resolvedHint}</Text>
          ) : null}
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24
  },
  panel: {
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
    gap: 12,
    paddingVertical: 28,
    paddingHorizontal: 24,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth
  },
  message: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 22
  },
  hint: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18
  }
})
