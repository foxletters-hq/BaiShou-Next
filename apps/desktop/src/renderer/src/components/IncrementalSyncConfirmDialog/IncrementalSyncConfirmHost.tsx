import React from 'react'
import { IncrementalSyncConfirmDialog } from './IncrementalSyncConfirmDialog'
import { useOrchestratedSync } from '../../hooks/useOrchestratedSync'

export const IncrementalSyncConfirmHost: React.FC = () => {
  const { planDialogOpen, planPreview, confirmSyncPlan, cancelSyncPlan } = useOrchestratedSync()

  return (
    <IncrementalSyncConfirmDialog
      open={planDialogOpen}
      preview={planPreview}
      onConfirm={() => void confirmSyncPlan()}
      onCancel={cancelSyncPlan}
    />
  )
}
