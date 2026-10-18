import i18n from 'i18next'
import React, { useEffect, useRef } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native'
import { useNativeTheme } from '../theme'
import { mobileTypography, sharedTokens } from '../../theme/tokens'

export interface IncrementalSyncPanelProps {
  onSync?: () => Promise<{
    uploaded: number
    downloaded: number
    conflicts: number
    skipped: number
  }>
  isConfigured?: boolean
  isSyncing?: boolean
  progress?: {
    current: number
    total: number
    statusText?: string
  } | null
}

export const IncrementalSyncPanel: React.FC<IncrementalSyncPanelProps> = ({
  onSync,
  isConfigured = true,
  isSyncing = false,
  progress
}) => {
  const { colors, tokens } = useNativeTheme()
  const progressAnim = useRef(new Animated.Value(0)).current

  const progressRatio = progress && progress.total > 0 ? progress.current / progress.total : 0

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progressRatio,
      duration: sharedTokens.animation.moderate,
      useNativeDriver: false
    }).start()
  }, [progressRatio, progressAnim])

  const handleSync = async () => {
    if (onSync) {
      await onSync()
    }
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.bgSurface,
          borderColor: colors.borderSubtle,
          borderRadius: tokens.radius.md
        }
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          {i18n.t(
            'auto.packages.ui.src.native.IncrementalSyncPanel.IncrementalSyncPanel.L58',
            '增量同步'
          )}
        </Text>
        {!isConfigured && (
          <Text style={[styles.hint, { color: colors.error }]}>
            {i18n.t(
              'auto.packages.ui.src.native.IncrementalSyncPanel.IncrementalSyncPanel.L60',
              '未配置同步目标'
            )}
          </Text>
        )}
      </View>

      <TouchableOpacity
        style={[
          styles.syncButton,
          {
            backgroundColor: isConfigured ? colors.primary : colors.bgSurfaceNormal,
            borderRadius: tokens.radius.xs
          }
        ]}
        onPress={handleSync}
        disabled={!isConfigured || isSyncing}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.syncButtonText,
            {
              color: isConfigured ? colors.textOnPrimary : colors.textTertiary
            }
          ]}
        >
          {isSyncing
            ? i18n.t(
                'auto.packages.ui.src.native.IncrementalSyncPanel.IncrementalSyncPanel.L84',
                '同步中...'
              )
            : i18n.t(
                'auto.packages.ui.src.native.IncrementalSyncPanel.IncrementalSyncPanel.L84',
                '同步'
              )}
        </Text>
      </TouchableOpacity>

      {progress && (
        <View style={styles.progressSection}>
          <View style={[styles.progressBarBg, { backgroundColor: colors.bgSurfaceNormal }]}>
            <Animated.View
              style={[
                styles.progressBarFill,
                {
                  backgroundColor: colors.primary,
                  width: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%']
                  })
                }
              ]}
            />
          </View>
          <Text style={[styles.progressText, { color: colors.textSecondary }]}>
            {progress.current}/{progress.total}
            {progress.statusText ? ` - ${progress.statusText}` : ''}
          </Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: sharedTokens.spacing.md,
    borderWidth: 1
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: sharedTokens.spacing.mdTight
  },
  title: {
    fontSize: mobileTypography.primary.fontSize,
    fontWeight: '600'
  },
  hint: {
    fontSize: mobileTypography.caption.fontSize
  },
  syncButton: {
    paddingVertical: sharedTokens.spacing.mdTight,
    alignItems: 'center',
    justifyContent: 'center'
  },
  syncButtonText: {
    fontSize: mobileTypography.body.fontSize,
    fontWeight: '600'
  },
  progressSection: {
    marginTop: sharedTokens.spacing.mdTight
  },
  progressBarBg: {
    height: 8,
    borderRadius: sharedTokens.radius.xs,
    overflow: 'hidden'
  },
  progressBarFill: {
    height: 8,
    borderRadius: sharedTokens.radius.xs
  },
  progressText: {
    fontSize: mobileTypography.caption.fontSize,
    marginTop: sharedTokens.spacing.xsPlus,
    textAlign: 'center'
  }
})
