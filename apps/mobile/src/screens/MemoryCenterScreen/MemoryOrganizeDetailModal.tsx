import React from 'react'
import { ActivityIndicator, ScrollView, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { ragBatchEmbedPhaseLabelKey } from '@baishou/shared'
import { mobileTypography } from '@baishou/ui/theme/tokens'
import { Button, Modal, modalActionsStyle, useNativeTheme, type RagState } from '@baishou/ui/native'
import {
  memoryOrganizePhaseRows,
  memoryOrganizeProgressPercent
} from './memory-center-organize.util'

export function MemoryOrganizeDetailModal(props: {
  visible: boolean
  ragState: RagState
  incomplete?: boolean
  onClose: () => void
  onPause: () => void
  onResume: () => void
  onCancel: () => void
  onContinue?: () => void
}) {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const running = props.ragState.isRunning && props.ragState.type === 'batchEmbed'
  const incomplete = Boolean(props.incomplete) && !running
  const cancelling = Boolean(props.ragState.cancelling)
  const rows = memoryOrganizePhaseRows({
    phase: props.ragState.phase,
    phases: props.ragState.phases
  })
  const overallPercent = memoryOrganizeProgressPercent(
    props.ragState.progress,
    props.ragState.total
  )
  const title = running
    ? t('memory.readiness_organizing', '正在整理记忆…')
    : incomplete
      ? t('memory.organize_incomplete', '整理未完成')
      : t('memory.organize_done', '整理完毕')
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
  const showPhases = running || incomplete
  return (
    <Modal visible={props.visible} title={title} animationType="none" onClose={props.onClose}>
      {showPhases ? (
        <ScrollView
          style={{ flexGrow: 0 }}
          contentContainerStyle={{ paddingRight: tokens.spacing.mdTight }}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
        >
          {incomplete && props.ragState.error ? (
            <View
              style={{
                marginBottom: tokens.spacing.sm,
                paddingHorizontal: tokens.spacing.smPlus,
                paddingVertical: tokens.spacing.xsPlus,
                borderRadius: tokens.radius.sm,
                borderWidth: 1,
                borderColor: colors.error,
                backgroundColor: colors.bgSurfaceNormal
              }}
            >
              <Text
                style={{
                  color: colors.error,
                  fontSize: mobileTypography.secondary.fontSize
                }}
              >
                {props.ragState.error}
              </Text>
            </View>
          ) : null}
          {running && detailText ? (
            <View
              style={{
                marginBottom: tokens.spacing.sm,
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
          {rows.length > 0 ? (
            rows.map((row) => {
              const label = t(ragBatchEmbedPhaseLabelKey(row.id), row.id)
              const value =
                row.status === 'skipped'
                  ? t('settings.rag_phase_skipped', '无需补齐')
                  : row.status === 'pending'
                    ? row.total > 0
                      ? row.id === 'graphNodes' || row.id === 'memories'
                        ? t('settings.rag_phase_pending_item_count', '待整理 {{count}} 个', {
                            count: row.total
                          })
                        : t('settings.rag_phase_pending_count', '待整理 {{count}} 篇', {
                            count: row.total
                          })
                      : t('settings.rag_phase_waiting', '等待中')
                    : row.status === 'done'
                      ? t('settings.rag_phase_done_count', '已完成 {{completed}}/{{total}}', {
                          completed: row.completed,
                          total: row.total
                        })
                      : `${row.completed}/${row.total}`
              return (
                <View
                  key={row.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: tokens.spacing.sm,
                    marginBottom: tokens.spacing.sm
                  }}
                >
                  <Text
                    style={{
                      width: 72,
                      color: row.status === 'skipped' ? colors.textTertiary : colors.textPrimary,
                      fontSize: mobileTypography.secondary.fontSize,
                      fontWeight: mobileTypography.secondary.fontWeight
                    }}
                    numberOfLines={1}
                  >
                    {label}
                  </Text>
                  {row.status === 'running' || row.status === 'done' ? (
                    <View
                      style={{
                        flex: 1,
                        height: 6,
                        borderRadius: tokens.radius.xs,
                        overflow: 'hidden',
                        backgroundColor: colors.bgSurfaceNormal
                      }}
                    >
                      <View
                        style={{
                          height: '100%',
                          width: `${row.barPercent}%`,
                          backgroundColor: colors.primary
                        }}
                      />
                    </View>
                  ) : (
                    <View style={{ flex: 1 }} />
                  )}
                  {row.status === 'running' && !props.ragState.paused && !incomplete ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : null}
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontSize: mobileTypography.caption.fontSize,
                      fontWeight: mobileTypography.caption.fontWeight
                    }}
                  >
                    {value}
                  </Text>
                </View>
              )
            })
          ) : (
            <>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: mobileTypography.secondary.fontSize,
                  fontWeight: mobileTypography.secondary.fontWeight,
                  marginBottom: tokens.spacing.sm
                }}
              >
                {props.ragState.statusText ||
                  t('settings.rag_batch_embed_starting', '正在开始索引…')}
              </Text>
              {props.ragState.total > 0 ? (
                <View
                  style={{
                    height: 6,
                    borderRadius: tokens.radius.xs,
                    overflow: 'hidden',
                    backgroundColor: colors.bgSurfaceNormal
                  }}
                >
                  <View
                    style={{
                      height: '100%',
                      width: `${overallPercent}%`,
                      backgroundColor: colors.primary
                    }}
                  />
                </View>
              ) : null}
            </>
          )}
        </ScrollView>
      ) : null}
      <View style={[modalActionsStyle, showPhases ? { marginTop: tokens.spacing.md } : null]}>
        {incomplete ? (
          <Button
            variant="outlined"
            size="sm"
            onPress={() => {
              props.onClose()
              props.onContinue?.()
            }}
          >
            {t('memory.organize_continue', '继续整理')}
          </Button>
        ) : running ? (
          <>
            <Button
              variant="outlined"
              size="sm"
              disabled={cancelling}
              onPress={props.ragState.paused ? props.onResume : props.onPause}
            >
              {props.ragState.paused
                ? t('settings.rag_batch_embed_resume', '继续')
                : t('settings.rag_batch_embed_pause', '暂停')}
            </Button>
            <Button variant="outlined" size="sm" disabled={cancelling} onPress={props.onCancel}>
              {t('settings.rag_batch_embed_cancel', '取消')}
            </Button>
          </>
        ) : null}
        <Button variant="outlined" size="sm" onPress={props.onClose}>
          {t('common.got_it', '知道了')}
        </Button>
      </View>
    </Modal>
  )
}
