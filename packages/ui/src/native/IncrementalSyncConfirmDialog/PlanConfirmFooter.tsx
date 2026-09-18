import React, { useEffect, useMemo, useState, memo } from 'react'
import { View } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { IncrementalSyncPlanPreview } from '@baishou/shared'
import {
  canExecuteIncrementalSyncPlan,
  requiresExplicitDeletePropagationChoice,
  type SyncDeletePropagationChoice
} from '@baishou/shared'
import { Button } from '../Button'
import { useNativeTheme } from '../theme'
import { useSyncConfirmCountdown } from './useSyncConfirmCountdown'
import { incrementalSyncConfirmStyles as styles } from './incremental-sync-confirm.styles'

export const PlanConfirmFooter = memo(function PlanConfirmFooter({
  preview,
  confirmEligibleAtMs,
  isConfirming,
  showCellularTrafficWarning,
  onConfirm,
  onCancel,
  onWaitForWifi
}: {
  preview: IncrementalSyncPlanPreview
  confirmEligibleAtMs: number | null
  isConfirming: boolean
  showCellularTrafficWarning: boolean
  onConfirm: (choice?: SyncDeletePropagationChoice) => void
  onCancel: () => void
  onWaitForWifi?: () => void
}) {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const needsSyncConfirm = canExecuteIncrementalSyncPlan(preview)
  const needsDeleteChoice = requiresExplicitDeletePropagationChoice(preview)
  const { confirmReady, secondsLeft } = useSyncConfirmCountdown(
    needsSyncConfirm,
    confirmEligibleAtMs
  )
  const [activeDeleteChoice, setActiveDeleteChoice] = useState<SyncDeletePropagationChoice | null>(
    null
  )

  useEffect(() => {
    if (!isConfirming) {
      setActiveDeleteChoice(null)
    }
  }, [isConfirming])

  const primaryButtonLabel = useMemo(() => {
    if (isConfirming) return t('data_sync.plan_confirming', '正在确认…')
    if (!needsSyncConfirm) return t('common.close', '关闭')
    if (!confirmReady) {
      return t('data_sync.plan_confirm_sync_countdown', {
        seconds: secondsLeft,
        defaultValue: '确认同步 ({{seconds}})'
      })
    }
    return showCellularTrafficWarning
      ? t('data_sync.plan_continue_sync', '继续同步')
      : t('data_sync.plan_confirm_sync', '确认同步')
  }, [confirmReady, isConfirming, needsSyncConfirm, secondsLeft, showCellularTrafficWarning, t])

  const choiceDisabled =
    (needsSyncConfirm && !confirmReady) || isConfirming || activeDeleteChoice != null

  const handleDeleteChoiceConfirm = (choice: SyncDeletePropagationChoice) => {
    if (choiceDisabled) return
    setActiveDeleteChoice(choice)
    onConfirm(choice)
  }

  if (needsDeleteChoice) {
    return (
      <View style={[styles.deleteChoiceFooter, { borderTopColor: colors.borderSubtle }]}>
        <Button
          variant="primary"
          destructive
          onPress={() => handleDeleteChoiceConfirm('follow-remote')}
          disabled={choiceDisabled}
          isLoading={activeDeleteChoice === 'follow-remote'}
          style={styles.fullWidthButton}
        >
          {t('data_sync.plan_delete_choice_follow_remote')}
        </Button>
        <Button
          variant="primary"
          onPress={() => handleDeleteChoiceConfirm('push-local')}
          disabled={choiceDisabled}
          isLoading={activeDeleteChoice === 'push-local'}
          style={styles.fullWidthButton}
        >
          {t('data_sync.plan_delete_choice_push_local')}
        </Button>
        <Button
          variant="outline"
          onPress={() => handleDeleteChoiceConfirm('skip-deletes')}
          disabled={choiceDisabled}
          isLoading={activeDeleteChoice === 'skip-deletes'}
          style={styles.fullWidthButton}
        >
          {t('data_sync.plan_delete_choice_skip_deletes')}
        </Button>
        <Button
          variant="outline"
          onPress={onCancel}
          disabled={choiceDisabled}
          style={styles.fullWidthButton}
        >
          {t('common.cancel', '取消')}
        </Button>
      </View>
    )
  }

  if (showCellularTrafficWarning && needsSyncConfirm) {
    return (
      <View style={[styles.deleteChoiceFooter, { borderTopColor: colors.borderSubtle }]}>
        <Button
          variant="primary"
          onPress={() => onConfirm()}
          disabled={choiceDisabled}
          isLoading={isConfirming}
          style={styles.fullWidthButton}
        >
          {primaryButtonLabel}
        </Button>
        <Button
          variant="outline"
          onPress={() => onWaitForWifi?.()}
          disabled={choiceDisabled || !onWaitForWifi}
          style={styles.fullWidthButton}
        >
          {t('data_sync.plan_wait_for_wifi', '等 Wi-Fi 再同步')}
        </Button>
        <Button
          variant="outline"
          onPress={onCancel}
          disabled={choiceDisabled}
          style={styles.fullWidthButton}
        >
          {t('common.cancel', '取消')}
        </Button>
      </View>
    )
  }

  return (
    <View style={[styles.actionsRow, { borderTopColor: colors.borderSubtle }]}>
      <Button variant="outline" onPress={onCancel} style={styles.actionButton}>
        {t('common.cancel', '取消')}
      </Button>
      <Button
        variant="primary"
        onPress={() => onConfirm()}
        disabled={choiceDisabled}
        isLoading={isConfirming}
        style={styles.actionButton}
      >
        {primaryButtonLabel}
      </Button>
    </View>
  )
})
