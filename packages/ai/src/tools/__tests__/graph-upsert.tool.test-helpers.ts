import { vi } from 'vitest'
import type { ToolContext } from '../agent.tool'

/** 所有 GraphUpsertTool 用例共用同一个 Vault id。 */
export const VAULT = 'vlt_aaaaaaaaaaaaaaaa'

export type RecordedGraphWrite = {
  collection?: string
  record: { id: string; [key: string]: any }
}

/** 统一的 rawDataSourceManager.writeRecord 收集器，记录写入的 collection 与 record。 */
export function createWriteRecorder(): {
  writes: RecordedGraphWrite[]
  writeRecord: ReturnType<typeof vi.fn>
} {
  const writes: RecordedGraphWrite[] = []
  const writeRecord = vi.fn(
    async (
      _kind: string,
      record: RecordedGraphWrite['record'],
      opts?: { collection?: string }
    ): Promise<void> => {
      writes.push({ collection: opts?.collection, record })
    }
  )
  return { writes, writeRecord }
}

export type GraphToolContextOverrides = {
  rawDataSourceManager?: unknown
  graphNodeLookup?: unknown
  graphEdgeLookup?: unknown
  deleteGraphRecord?: unknown
  syncGraphPendingIndex?: unknown
}

/** 构造测试上下文，统一补齐 vaultId / vaultName。 */
export function createGraphToolContext(overrides: GraphToolContextOverrides): ToolContext {
  return {
    vaultId: VAULT,
    vaultName: 'Personal',
    ...overrides
  } as unknown as ToolContext
}
