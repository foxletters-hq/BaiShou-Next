import React from 'react'
import { IncrementalSyncConfirmDialog } from './IncrementalSyncConfirmDialog'
import { useOrchestratedSync } from '../../hooks/useOrchestratedSync'

export const IncrementalSyncConfirmHost: React.FC = () => {
  const { planDialogOpen, planPreview, isConfirmingPlan, confirmSyncPlan, cancelSyncPlan } =
    useOrchestratedSync()

  return (
    <IncrementalSyncConfirmDialog
      open={planDialogOpen}
      preview={planPreview}
      isConfirming={isConfirmingPlan}
      onConfirm={() => void confirmSyncPlan()}
      onCancel={cancelSyncPlan}
    />
  )
}
