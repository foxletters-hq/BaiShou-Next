import React, { useEffect, useRef } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated
} from 'react-native'
import { useNativeTheme } from '../theme'

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

  const progressRatio =
    progress && progress.total > 0 ? progress.current / progress.total : 0

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progressRatio,
      duration: 300,
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
          🔄 增量同步
        </Text>
        {!isConfigured && (
          <Text style={[styles.hint, { color: colors.error }]}>
            未配置同步目标
          </Text>
        )}
      </View>

      <TouchableOpacity
        style={[
          styles.syncButton,
          {
            backgroundColor: isConfigured ? colors.primary : colors.bgSurfaceNormal,
            borderRadius: tokens.radius.sm
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
          🔄 {isSyncing ? '同步中...' : '同步'}
        </Text>
      </TouchableOpacity>

      {progress && (
        <View style={styles.progressSection}>
          <View
            style={[
              styles.progressBarBg,
              { backgroundColor: colors.bgSurfaceNormal }
            ]}
          >
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
    padding: 16,
    borderWidth: 1
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  title: {
    fontSize: 16,
    fontWeight: '600'
  },
  hint: {
    fontSize: 12
  },
  syncButton: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  syncButtonText: {
    fontSize: 15,
    fontWeight: '600'
  },
  progressSection: {
    marginTop: 12
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden'
  },
  progressBarFill: {
    height: 8,
    borderRadius: 4
  },
  progressText: {
    fontSize: 12,
    marginTop: 6,
    textAlign: 'center'
  }
})
