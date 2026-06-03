/**
 * @baishou/core — 桌面与移动端共用的业务逻辑（无 Git、Electron 旧版导入等桌面专用模块）
 */

export * from './fs'

export * from './diary/diary.service'
export * from './diary/file-sync.service'
export * from './diary/vault-index.service'
export * from './diary/diary-export.service'
export * from './services/agent.service'
export * from './vault/vault.types'
export * from './vault/storage-path.types'
export * from './vault/vault.errors'
export * from './vault/vault.service'
export * from './attachments/attachment-manager.types'
export * from './attachments/attachment-manager.service'
export * from './diary/diary.types'

export * from './session/session-file.service'
export * from './session/session-sync.service'
export * from './session/session-manager.service'

export * from './assistant/assistant-file.service'
export * from './assistant/assistant-manager.service'

export * from './settings/settings-file.service'
export * from './settings/settings-manager.service'

export * from './session/compression-prompt'
export * from './session/compression.service'
export * from './session/system-prompt-builder'
export * from './session/model-pricing.service'
export * from './session/memory-deduplication.service'

export * from './summary/summary-prompt-templates'
export * from './summary/summary-generator.service'
export * from './vault/summary-file.service'
export * from './summary/summary-sync.service'
export * from './summary/summary-manager.service'
export * from './summary/missing-summary-detector.service'
export {
  buildSharedContextText,
  handleBuildSharedContext,
  type SharedContextDiaryRow
} from './summary/summary-context'

export * from './archive/archive.interface'

export * from './network/lan-sync.interface'
export * from './network/cloud-sync.interface'

export * from './shadow-index/shadow-index-sync.service'
