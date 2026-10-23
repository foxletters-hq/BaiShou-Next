import type { IncrementalSyncRunOptions } from '../types/version-control.types'
import type { SyncManifest } from '../types/version-control.types'
import {
  inspectDeletePropagationBlock,
  resolveSyncMergeDecisions,
  type SyncDeletePropagationBlockReason,
  type SyncDeletePropagationDirection
} from './sync-delete-guard'
import type { MergeDecision } from './three-way-merge'
import { threeWayMerge } from './three-way-merge'

export type IncrementalSyncPlanMergeResult = {
  decisions: MergeDecision[]
  deleteBlock: {
    deleteCount: number
    direction: SyncDeletePropagationDirection
    reason: SyncDeletePropagationBlockReason
  } | null
}

export type IncrementalSyncPlanMergeOptions = IncrementalSyncRunOptions & {
  /** V2.5：rename 旧前缀路径，不计入 mass_delete */
  ignoreDeleteRemotePaths?: ReadonlySet<string>
}

/** 生成规划/预览用合并决策；若已提供删除传播选择则与执行阶段一致 */
export function buildIncrementalSyncPlanMergeResult(
  local: SyncManifest,
  remote: SyncManifest,
  ancestor: SyncManifest,
  previousLocal?: SyncManifest,
  runOptions?: IncrementalSyncPlanMergeOptions
): IncrementalSyncPlanMergeResult {
  const rawDecisions = threeWayMerge(local, remote, ancestor)
  const guardOptions = {
    ignoreDeleteRemotePaths: runOptions?.ignoreDeleteRemotePaths
  }
  const deleteBlock = inspectDeletePropagationBlock(
    rawDecisions,
    local,
    remote,
    ancestor,
    previousLocal,
    guardOptions
  )

  if (runOptions?.deletePropagationChoice) {
    return {
      decisions: resolveSyncMergeDecisions(rawDecisions, local, remote, ancestor, previousLocal, {
        deletePropagationChoice: runOptions.deletePropagationChoice,
        ignoreDeleteRemotePaths: runOptions.ignoreDeleteRemotePaths
      }),
      deleteBlock: null
    }
  }

  return {
    decisions: rawDecisions,
    deleteBlock: deleteBlock
      ? {
          deleteCount: deleteBlock.deleteCount,
          direction: deleteBlock.direction,
          reason: deleteBlock.reason
        }
      : null
  }
}
