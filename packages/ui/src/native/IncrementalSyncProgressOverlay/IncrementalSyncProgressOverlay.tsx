import React, { useEffect, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Animated,
  ActivityIndicator,
  Easing,
  Platform,
  Modal
} from 'react-native'
import { useTranslation } from 'react-i18next'
import type { SyncProgressEvent } from '@baishou/shared'
import {
  formatSyncProgressStatus,
  type SyncProgressTranslate
} from '../../utils/formatSyncProgress'
import { useNativeTheme } from '../theme'

export type IncrementalSyncProgressOverlayState = Partial<
  Pick<SyncProgressEvent, 'phase' | 'fileName' | 'action' | 'statusText'>
> & {
  current: number
  total: number
}

export interface IncrementalSyncProgressOverlayProps {
  visible: boolean
  progress: IncrementalSyncProgressOverlayState | null
  /** 距屏幕顶部的偏移，避免遮挡日期栏等顶部控件（仅 banner 模式） */
  topInset?: number
  /** 全屏遮罩并拦截触摸，用于规划/同步进行中 */
  blocking?: boolean
  /** 全屏遮罩主标题（blocking 模式） */
  blockingTitle?: string
  /** 全屏遮罩副提示（blocking 模式） */
  blockingHint?: string
  onRequestClose?: () => void
}

function resolveProgressLabel(
  progress: IncrementalSyncProgressOverlayState,
  t: SyncProgressTranslate
): string {
  if (progress.action && progress.fileName) {
    return formatSyncProgressStatus({ action: progress.action, fileName: progress.fileName }, t)
  }

  switch (progress.phase) {
    case 'scanning':
      return t('data_sync.progress_scanning_local', '正在扫描本地文件…')
    case 'comparing':
      return t('data_sync.progress_fetching_remote', '正在获取远程清单…')
    case 'finalizing':
      return t('data_sync.progress_finalizing', '正在保存同步状态…')
    case 'syncing':
      if (progress.fileName) {
        const base = progress.fileName.split('/').pop() ?? progress.fileName
        return base
      }
      return t('data_sync.syncing', '同步中…')
    default:
      return progress.statusText ?? t('data_sync.syncing', '同步中…')
  }
}

export const IncrementalSyncProgressOverlay: React.FC<IncrementalSyncProgressOverlayProps> = ({
  visible,
  progress,
  topInset = 4,
  blocking = false,
  blockingTitle,
  blockingHint,
  onRequestClose
}) => {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const progressAnim = useRef(new Animated.Value(0)).current
  const enterAnim = useRef(new Animated.Value(0)).current
  const wasVisibleRef = useRef(false)

  const ratio =
    progress?.phase === 'finalizing'
      ? 1
      : progress && progress.total > 0
        ? Math.min(1, progress.current / progress.total)
        : 0

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: ratio,
      duration: progress?.phase === 'finalizing' ? 120 : 200,
      useNativeDriver: false
    }).start()
  }, [progressAnim, ratio, progress?.phase])

  useEffect(() => {
    if (visible) {
      if (!wasVisibleRef.current) {
        enterAnim.setValue(0)
        Animated.timing(enterAnim, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true
        }).start()
      }
      wasVisibleRef.current = true
      return
    }

    if (wasVisibleRef.current) {
      wasVisibleRef.current = false
      Animated.timing(enterAnim, {
        toValue: 0,
        duration: 160,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true
      }).start()
    }
  }, [visible, enterAnim])

  if (!visible) return null

  const resolvedProgress: IncrementalSyncProgressOverlayState = progress ?? {
    phase: 'scanning',
    current: 0,
    total: 0
  }

  const label = resolveProgressLabel(resolvedProgress, (key, defaultValue, options) =>
    options
      ? String(t(key, { defaultValue: defaultValue ?? '', ...options }))
      : String(t(key, defaultValue ?? ''))
  )
  const showCounts = resolvedProgress.total > 0 || resolvedProgress.phase === 'finalizing'
  const countCurrent =
    resolvedProgress.phase === 'finalizing' && resolvedProgress.total <= 1
      ? resolvedProgress.total || 1
      : resolvedProgress.current
  const countTotal =
    resolvedProgress.phase === 'finalizing' && resolvedProgress.total <= 1
      ? resolvedProgress.total || 1
      : resolvedProgress.total

  const bannerAnimStyle = {
    opacity: enterAnim,
    transform: [
      {
        translateY: enterAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [-8, 0]
        })
      }
    ]
  }

  const resolvedBlockingTitle =
    blockingTitle ?? t('data_sync.syncing', '同步中…')
  const resolvedBlockingHint =
    blockingHint ??
    (resolvedProgress.phase === 'scanning' || resolvedProgress.phase === 'comparing'
      ? t('data_sync.planning_blocking_hint', '正在分析同步变更，请勿离开或操作其他功能')
      : t('data_sync.sync_blocking_hint', '同步进行中，请勿离开或操作其他功能'))

  const banner = (
    <Animated.View
      style={[
        styles.banner,
        blocking ? null : bannerAnimStyle,
        {
          backgroundColor: colors.bgSurface,
          borderColor: colors.borderMuted,
          borderRadius: tokens.radius.lg
        }
      ]}
    >
      <View style={styles.titleRow}>
        {resolvedProgress.total === 0 ? (
          <ActivityIndicator size="small" color={colors.primary} style={styles.spinner} />
        ) : null}
        <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
          {blocking ? resolvedBlockingTitle : t('data_sync.syncing', '同步中…')}
        </Text>
        {showCounts ? (
          <Text style={[styles.count, { color: colors.textSecondary }]}>
            {countCurrent}/{countTotal}
          </Text>
        ) : null}
      </View>

      <View style={[styles.track, { backgroundColor: colors.bgSurfaceNormal }]}>
        {resolvedProgress.total > 0 || resolvedProgress.phase === 'finalizing' ? (
          <Animated.View
            style={[
              styles.fill,
              {
                backgroundColor: colors.primary,
                width: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%']
                })
              }
            ]}
          />
        ) : (
          <View style={[styles.fill, styles.indeterminate, { backgroundColor: colors.primary }]} />
        )}
      </View>

      <Text style={[styles.detail, { color: colors.textSecondary }]} numberOfLines={2}>
        {label}
      </Text>
      {blocking && resolvedBlockingHint ? (
        <Text style={[styles.blockingHint, { color: colors.textTertiary }]} numberOfLines={2}>
          {resolvedBlockingHint}
        </Text>
      ) : null}
    </Animated.View>
  )

  if (blocking) {
    return (
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={onRequestClose}
      >
        <View style={[styles.blockingOverlay, { backgroundColor: colors.overlay || 'rgba(0,0,0,0.55)' }]}>
          {banner}
        </View>
      </Modal>
    )
  }

  return (
    <View style={[styles.host, { top: topInset }]} pointerEvents="none">
      {banner}
    </View>
  )
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 9999
  },
  banner: {
    width: '100%',
    maxWidth: 420,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8
      },
      android: {
        elevation: 3
      },
      default: {}
    })
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8
  },
  spinner: {
    marginRight: -4
  },
  title: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600'
  },
  count: {
    fontSize: 12,
    fontWeight: '500'
  },
  track: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden'
  },
  fill: {
    height: 6,
    borderRadius: 3
  },
  indeterminate: {
    width: '35%',
    opacity: 0.85
  },
  detail: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 16
  },
  blockingHint: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center'
  },
  blockingOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24
  }
})
