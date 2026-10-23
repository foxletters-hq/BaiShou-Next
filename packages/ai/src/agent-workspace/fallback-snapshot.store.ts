import {
  emptyRestoreResult,
  type WorkspaceSnapshotHandle,
  type WorkspaceSnapshotStore
} from './workspace-snapshot-store'

export interface FallbackSnapshotStoreOptions {
  /** 首选实现，通常是影子 Git */
  primary: WorkspaceSnapshotStore
  /** 首选实现不可用时的兜底，通常是纯文本快照 */
  fallback: WorkspaceSnapshotStore
  onDowngrade?: (input: { folderRoot: string; error: unknown }) => void
}

export interface FallbackSnapshotStore extends WorkspaceSnapshotStore {
  /** 该工作台当前实际生效的实现，用于告知用户能力是否受限 */
  activeKindFor(folderRoot: string): WorkspaceSnapshotStore['kind']
  clearDowngrade(folderRoot: string): void
}

/**
 * 让快照在首选实现失效时仍然可用。
 *
 * 降级按工作台记忆：某个文件夹上 Git 快照失败过一次（仓库建不起来、目录太大、命令超时），
 * 后续轮次直接走兜底实现，不再每轮都付一次失败的代价。
 *
 * 恢复操作始终按句柄自身的类型路由——降级之前拍的 Git 快照，降级之后依然要能回滚。
 */
export function createFallbackSnapshotStore(
  options: FallbackSnapshotStoreOptions
): FallbackSnapshotStore {
  const downgraded = new Set<string>()

  const storeForHandle = (handle: WorkspaceSnapshotHandle): WorkspaceSnapshotStore | null => {
    if (handle.kind === options.primary.kind) return options.primary
    if (handle.kind === options.fallback.kind) return options.fallback
    return null
  }

  return {
    kind: options.primary.kind,

    activeKindFor(folderRoot: string) {
      return downgraded.has(folderRoot) ? options.fallback.kind : options.primary.kind
    },

    clearDowngrade(folderRoot: string) {
      downgraded.delete(folderRoot)
    },

    async capture(input) {
      if (!downgraded.has(input.folderRoot)) {
        try {
          return await options.primary.capture(input)
        } catch (error) {
          downgraded.add(input.folderRoot)
          options.onDowngrade?.({ folderRoot: input.folderRoot, error })
        }
      }
      return options.fallback.capture(input)
    },

    async extend(input) {
      const store = storeForHandle(input.handle)
      return store ? store.extend(input) : input.handle
    },

    listPaths(handle) {
      return storeForHandle(handle)?.listPaths(handle) ?? null
    },

    async restore(input) {
      const store = storeForHandle(input.handle)
      return store ? store.restore(input) : emptyRestoreResult()
    },

    async diffPaths(input) {
      if (input.from.kind !== input.to.kind) return null
      const store = storeForHandle(input.from)
      return store ? store.diffPaths(input) : null
    }
  }
}
