import type { SyncDeletePropagationBlockReason } from './sync-delete-guard'
import type { SyncDeletePropagationChoice } from '../types/version-control.types'

export type { SyncDeletePropagationChoice }

export function requiresExplicitDeletePropagationChoice(preview: {
  deletePropagationBlocked: boolean
}): boolean {
  return preview.deletePropagationBlocked
}

export function getDeletePropagationChoiceTitleKey(
  reason: SyncDeletePropagationBlockReason | undefined
): string {
  switch (reason) {
    case 'remote_data_loss':
      return 'data_sync.plan_delete_choice_title_remote_loss'
    case 'local_data_loss':
      return 'data_sync.plan_delete_choice_title_local_loss'
    case 'mass_delete':
    default:
      return 'data_sync.plan_delete_choice_title_mass_delete'
  }
}

export function getDeletePropagationChoiceDescKey(
  reason: SyncDeletePropagationBlockReason | undefined
): string {
  switch (reason) {
    case 'remote_data_loss':
      return 'data_sync.plan_delete_choice_desc_remote_loss'
    case 'local_data_loss':
      return 'data_sync.plan_delete_choice_desc_local_loss'
    case 'mass_delete':
    default:
      return 'data_sync.plan_delete_choice_desc_mass_delete'
  }
}
