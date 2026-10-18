import React from 'react'
import { ActivityIndicator, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { mobileTypography } from '@baishou/ui/theme/tokens'
import { Button, modalActionsStyle, useNativeTheme } from '@baishou/ui/native'
import type { RagState } from '@baishou/ui/native'
import { memoryOrganizeProgressPercent } from './memory-center-organize.util'

export function MemoryOrganizeProgressCard(props: {
  ragState: RagState
  incomplete?: boolean
  onViewDetails: () => void
  onContinue?: () => void
}) {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const cancelling = Boolean(props.ragState.cancelling)
  const incomplete = Boolean(props.incomplete)
  const percent = memoryOrganizeProgressPercent(props.ragState.progress, props.ragState.total)
  const isRunning = !incomplete && !props.ragState.paused && !cancelling
  const title = cancelling
    ? t('settings.rag_batch_embed_cancelling', '正在取消索引…')
    : incomplete
      ? t('memory.organize_incomplete', '整理未完成')
      : props.ragState.paused
        ? t('settings.rag_batch_embed_paused', '索引已暂停')
        : t('memory.readiness_organizing', '正在整理记忆…')

  const rawDetail = props.ragState.statusText?.trim()
  const cleanDetail = rawDetail
    ? rawDetail
        .replace(/[（(]\s*第\s*\d+\s*\/\s*\d+\s*篇\s*[）)]/g, '')
        .replace(/[（(]\s*已完成\s*\d+\s*\/\s*\d+\s*篇\s*[）)]/g, '')
        .replace(/[（(]\s*\d+\s*\/\s*\d+\s*件目\s*[）)]/g, '')
        .replace(/[（(]\s*\d+\s*\/\s*\d+\s*[）)]/g, '')
        .trim()
    : undefined
  const detailText = cleanDetail && cleanDetail !== title ? cleanDetail : undefined
  const hasProgressCount = props.ragState.total > 0

  return (
    <View
      style={{
        marginTop: tokens.spacing.sm,
        padding: tokens.spacing.md,
        borderRadius: tokens.radius.md,
        borderWidth: 1,
        borderColor: colors.borderControl,
        backgroundColor: colors.bgSurface
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: tokens.spacing.sm
        }}
      >
        {!incomplete && !props.ragState.paused ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : null}
        <Text
          style={{
            flex: 1,
            color: colors.textPrimary,
            fontSize: mobileTypography.primary.fontSize,
            fontWeight: mobileTypography.secondary.fontWeight
          }}
          numberOfLines={1}
        >
          {title}
        </Text>
        <View style={modalActionsStyle}>
          <Button variant="outlined" size="sm" onPress={props.onViewDetails}>
            {t('memory.organize_view_details', '查看详情')}
          </Button>
          {incomplete && props.onContinue ? (
            <Button variant="outlined" size="sm" onPress={props.onContinue}>
              {t('memory.organize_continue', '继续整理')}
            </Button>
          ) : null}
        </View>
      </View>

      {isRunning && detailText ? (
        <View
          style={{
            marginTop: tokens.spacing.sm,
            paddingHorizontal: tokens.spacing.smPlus,
            paddingVertical: tokens.spacing.xsPlus,
            borderRadius: tokens.radius.sm,
            backgroundColor: colors.bgSurfaceNormal,
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: tokens.spacing.xsPlus
          }}
        >
          <View
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: colors.primary,
              marginTop: 5
            }}
          />
          <Text
            style={{
              flex: 1,
              color: colors.textSecondary,
              fontSize: mobileTypography.secondary.fontSize
            }}
          >
            {detailText}
          </Text>
        </View>
      ) : null}

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: tokens.spacing.sm
        }}
      >
        <Text
          style={{
            color: colors.textTertiary,
            fontSize: mobileTypography.caption.fontSize
          }}
        >
          {isRunning && !detailText ? t('common.processing', '处理中') : ''}
        </Text>
        {hasProgressCount ? (
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: mobileTypography.caption.fontSize,
              fontWeight: mobileTypography.secondary.fontWeight
            }}
          >
            {t('settings.rag_batch_embed_total_progress_label', '总进度')} {props.ragState.progress}
            /{props.ragState.total} ({Math.round(percent)}%)
          </Text>
        ) : (
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: mobileTypography.caption.fontSize,
              fontWeight: mobileTypography.secondary.fontWeight
            }}
          >
            {Math.round(percent)}%
          </Text>
        )}
      </View>

      <View
        style={{
          height: 6,
          borderRadius: tokens.radius.xs,
          overflow: 'hidden',
          backgroundColor: colors.bgSurfaceNormal,
          marginTop: tokens.spacing.xsPlus
        }}
      >
        <View
          style={{
            height: '100%',
            width: `${percent}%`,
            backgroundColor: colors.primary
          }}
        />
      </View>

      {isRunning ? (
        <Text
          style={{
            marginTop: tokens.spacing.xsPlus,
            color: colors.textTertiary,
            fontSize: mobileTypography.caption.fontSize
          }}
        >
          {t(
            'memory.organize_background_hint',
            '提示：大模型整理涉及多轮分析，切至后台或锁屏可能会被系统暂停，建议保持在前台。'
          )}
        </Text>
      ) : incomplete ? (
        <Text
          style={{
            marginTop: tokens.spacing.xsPlus,
            color: colors.textTertiary,
            fontSize: mobileTypography.caption.fontSize
          }}
        >
          {t('memory.organize_incomplete_hint', '已保存此前整理进度，点击「继续整理」可直接恢复。')}
        </Text>
      ) : null}
    </View>
  )
}
