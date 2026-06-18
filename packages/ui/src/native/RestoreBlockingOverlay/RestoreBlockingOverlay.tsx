import React from 'react'
import { Modal, View, Text, ActivityIndicator, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'

export interface RestoreBlockingOverlayProps {
  visible: boolean
  message?: string
  hint?: string
  detail?: string
  /** 0–100；未提供时仅显示不确定进度圈 */
  progress?: number
  /** 成功态：显示勾号样式提示而非转圈 */
  succeeded?: boolean
}

export const RestoreBlockingOverlay: React.FC<RestoreBlockingOverlayProps> = ({
  visible,
  message,
  hint,
  detail,
  progress,
  succeeded = false
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const resolvedMessage = message ?? t('settings.restoring_data', '正在恢复数据...')
  const resolvedHint = hint ?? t('settings.restoring_data_hint', '请勿关闭应用或进行其他操作')
  const showProgressBar = typeof progress === 'number' && Number.isFinite(progress)
  const clampedProgress = showProgressBar ? Math.min(100, Math.max(0, progress)) : 0

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
          {succeeded ? (
            <Text style={[styles.successMark, { color: colors.primary }]}>✓</Text>
          ) : (
            <ActivityIndicator size="large" color={colors.primary} />
          )}
          <Text style={[styles.message, { color: colors.textPrimary }]}>{resolvedMessage}</Text>
          {showProgressBar ? (
            <View style={styles.progressBlock}>
              <View style={[styles.progressTrack, { backgroundColor: colors.borderMuted }]}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      backgroundColor: colors.primary,
                      width: `${clampedProgress}%`
                    }
                  ]}
                />
              </View>
              <Text style={[styles.progressText, { color: colors.textSecondary }]}>
                {clampedProgress}%
              </Text>
            </View>
          ) : null}
          {detail ? (
            <Text style={[styles.detail, { color: colors.textSecondary }]} numberOfLines={2}>
              {detail}
            </Text>
          ) : null}
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
  successMark: {
    fontSize: 40,
    fontWeight: '700',
    lineHeight: 44
  },
  message: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 22
  },
  progressBlock: {
    width: '100%',
    gap: 6
  },
  progressTrack: {
    width: '100%',
    height: 8,
    borderRadius: 999,
    overflow: 'hidden'
  },
  progressFill: {
    height: '100%',
    borderRadius: 999
  },
  progressText: {
    fontSize: 13,
    textAlign: 'center'
  },
  detail: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17
  },
  hint: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18
  }
})
