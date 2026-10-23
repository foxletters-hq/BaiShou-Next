import React from 'react'
import { Modal, View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { IncrementalSyncPlanPreview } from '@baishou/shared'
import { formatIncrementalSyncPlanBytes, type SyncDeletePropagationChoice } from '@baishou/shared'
import { useNativeTheme } from '../theme'
import { PlanScrollContent } from './PlanScrollContent'
import { PlanConfirmFooter } from './PlanConfirmFooter'
import { incrementalSyncConfirmStyles as styles } from './incremental-sync-confirm.styles'

export interface IncrementalSyncConfirmDialogProps {
  visible: boolean
  preview: IncrementalSyncPlanPreview | null
  confirmEligibleAtMs: number | null
  isConfirming?: boolean
  /** 蜂窝且超阈值时显示警告与「等 Wi-Fi」按钮；桌面恒 false */
  showCellularTrafficWarning?: boolean
  onConfirm: (choice?: SyncDeletePropagationChoice) => void
  onCancel: () => void
  /** 「等 Wi-Fi 再同步」：取消当前同步并记 pending */
  onWaitForWifi?: () => void
}

export const IncrementalSyncConfirmDialog: React.FC<IncrementalSyncConfirmDialogProps> = ({
  visible,
  preview,
  confirmEligibleAtMs,
  isConfirming = false,
  showCellularTrafficWarning = false,
  onConfirm,
  onCancel,
  onWaitForWifi
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const { height: windowHeight } = useWindowDimensions()
  const dialogHeight = Math.min(Math.floor(windowHeight * 0.82), windowHeight - 32)

  if (!visible || !preview) return null

  const totalTrafficBytes =
    Math.max(0, preview.totalUploadBytes || 0) + Math.max(0, preview.totalDownloadBytes || 0)

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel={t('common.cancel', '取消')}
        />

        <View style={styles.dialogWrap} pointerEvents="box-none">
          <View
            style={[
              styles.dialog,
              {
                height: dialogHeight,
                backgroundColor: colors.bgSurface,
                borderColor: colors.borderSubtle
              }
            ]}
          >
            <View style={styles.headerBlock}>
              <Text style={[styles.title, { color: colors.textPrimary }]}>
                {t('data_sync.plan_confirm_title', '确认同步')}
              </Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                {t('data_sync.plan_confirm_desc', {
                  count: preview.changeCount,
                  activeVault: preview.activeVaultName ?? t('workspace.no_active', '未选择工作空间')
                })}
              </Text>
              <Text style={[styles.trafficSummary, { color: colors.textTertiary }]}>
                {t('data_sync.plan_traffic_summary', {
                  download: formatIncrementalSyncPlanBytes(preview.totalDownloadBytes),
                  upload: formatIncrementalSyncPlanBytes(preview.totalUploadBytes),
                  defaultValue: '下载 {{download}} · 上传 {{upload}}'
                })}
                {typeof preview.renamedFileCount === 'number' && preview.renamedFileCount > 0
                  ? ` · ${t('data_sync.plan_rename_summary', {
                      count: preview.renamedFileCount,
                      defaultValue: '云端重命名 {{count}} 个文件'
                    })}`
                  : ''}
              </Text>
              {showCellularTrafficWarning ? (
                <Text style={[styles.cellularWarning, { color: colors.warning }]}>
                  {t('data_sync.plan_traffic_cellular_warning', {
                    size: formatIncrementalSyncPlanBytes(totalTrafficBytes),
                    defaultValue:
                      '正在使用移动数据，本次约需 {{size}}。首次全量同步通常更大，属一次性传输。'
                  })}
                </Text>
              ) : null}
            </View>

            <PlanScrollContent preview={preview} />

            <PlanConfirmFooter
              preview={preview}
              confirmEligibleAtMs={confirmEligibleAtMs}
              isConfirming={isConfirming}
              showCellularTrafficWarning={showCellularTrafficWarning}
              onConfirm={onConfirm}
              onCancel={onCancel}
              onWaitForWifi={onWaitForWifi}
            />
          </View>
        </View>
      </View>
    </Modal>
  )
}
