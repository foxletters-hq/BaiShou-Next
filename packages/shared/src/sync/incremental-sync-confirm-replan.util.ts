import type { IncrementalSyncPlanPreview } from '../types/incremental-sync-plan.types'
import { hasIncrementalSyncPlanMaterialChange } from './incremental-sync-plan-compare.util'
import {
  evaluateIncrementalSyncPlanDrift,
  shouldReplanIncrementalSyncOnConfirm,
  type IncrementalSyncPlanReuseBaseline
} from './incremental-sync-plan-reuse.util'
import type { SyncManifest } from '../types/version-control.types'

export type IncrementalSyncConfirmReplanInput = {
  stalePreview: IncrementalSyncPlanPreview
  planPreparedAtMs: number | null
  planReuseBaseline?: IncrementalSyncPlanReuseBaseline | null
  vaultRegistryChanged: boolean
  highDivergenceConfirmed: boolean
  deletePropagationChoiceProvided: boolean
  /** 已检测的漂移结果（优先于 manifest 现场比对） */
  drift?: {
    localTreeDrifted?: boolean
    remoteManifestDrifted?: boolean
  }
  localManifest?: SyncManifest | null
  remoteManifest?: SyncManifest | null
}

export type IncrementalSyncConfirmReplanResult = {
  needsReplan: boolean
  localTreeDrifted: boolean
  remoteManifestDrifted: boolean
}

/** 确认同步前判断是否需要重新规划（桌面/移动共用） */
export function resolveIncrementalSyncConfirmReplan(
  input: IncrementalSyncConfirmReplanInput
): IncrementalSyncConfirmReplanResult {
  let localTreeDrifted = input.drift?.localTreeDrifted ?? false
  let remoteManifestDrifted = input.drift?.remoteManifestDrifted ?? false

  if (
    input.drift == null &&
    input.planReuseBaseline &&
    input.localManifest &&
    input.remoteManifest
  ) {
    const evaluated = evaluateIncrementalSyncPlanDrift(
      input.planReuseBaseline,
      input.localManifest,
      input.remoteManifest
    )
    localTreeDrifted = evaluated.localTreeDrifted
    remoteManifestDrifted = evaluated.remoteManifestDrifted
  }

  const needsReplan = shouldReplanIncrementalSyncOnConfirm(
    input.stalePreview,
    input.planPreparedAtMs,
    {
      vaultRegistryChanged: input.vaultRegistryChanged,
      highDivergenceConfirmed: input.highDivergenceConfirmed,
      deletePropagationChoiceProvided: input.deletePropagationChoiceProvided,
      localTreeDrifted,
      remoteManifestDrifted
    }
  )

  return { needsReplan, localTreeDrifted, remoteManifestDrifted }
}

/** 重规划后是否要求用户再次确认（已选删除传播方式时跳过二次确认） */
export function shouldRequireIncrementalSyncReconfirmAfterReplan(
  needsReplan: boolean,
  stalePreview: IncrementalSyncPlanPreview,
  freshPreview: IncrementalSyncPlanPreview,
  deletePropagationChoiceProvided: boolean
): boolean {
  if (!needsReplan) return false
  if (deletePropagationChoiceProvided) return false
  return hasIncrementalSyncPlanMaterialChange(stalePreview, freshPreview)
}
