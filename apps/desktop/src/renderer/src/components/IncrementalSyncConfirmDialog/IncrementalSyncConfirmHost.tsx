import React from 'react'
import type { SyncDeletePropagationChoice } from '@baishou/shared'
import { IncrementalSyncConfirmDialog } from './IncrementalSyncConfirmDialog'
import { useOrchestratedSync } from '../../hooks/useOrchestratedSync'

export const IncrementalSyncConfirmHost: React.FC = () => {
  const { planDialogOpen, planPreview, planConfirmEligibleAt, isConfirmingPlan, confirmSyncPlan, cancelSyncPlan } =
    useOrchestratedSync()

  return (
    <IncrementalSyncConfirmDialog
      open={planDialogOpen}
      preview={planPreview}
      confirmEligibleAtMs={planConfirmEligibleAt}
      isConfirming={isConfirmingPlan}
      onConfirm={(choice) => void confirmSyncPlan(choice)}
      onCancel={cancelSyncPlan}
    />
  )
}
