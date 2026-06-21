/**
 * @baishou/core — 桌面端专用（Git 同步、旧版导入、Electron 等）
 */

export * from './attachments/attachment-manager.service'

export * from './summary/summary-context'

export * from './import/legacy-import.service'

export * from './sync/git-sync.interface'
export * from './sync/git-sync.service'
export * from './sync/git-binary.registry'
export * from './sync/incremental-sync.interface'
export * from './sync/version-manager.interface'
export * from './sync/version-manager.service'
export * from './sync/sync.errors'
export * from './sync/sync-orchestrator.interface'
export * from './sync/sync-orchestrator'
export * from './sync/operation-log.interface'
export * from './sync/operation-log.service'
export * from './sync/three-way-merge'
export * from './sync/three-way-sync.service'

export { createNodeFileSystem } from './fs/create-node-file-system'
export { NodeFileSystem } from './fs/node-file-system'
