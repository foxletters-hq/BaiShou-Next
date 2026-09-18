import { useSyncExternalStore } from 'react'
import { getReasoningCatalogEpoch, subscribeReasoningCatalog } from '@baishou/shared'

/** 思考目录更新后让菜单按新档位重算 */
export function useReasoningCatalogEpoch(): number {
  return useSyncExternalStore(
    subscribeReasoningCatalog,
    getReasoningCatalogEpoch,
    getReasoningCatalogEpoch
  )
}
