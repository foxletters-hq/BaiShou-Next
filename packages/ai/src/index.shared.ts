/** Shared barrel for @baishou/ai (desktop + React Native). */

export * from './types'
export * from './errors'
export * from './providers/provider.registry'
export * from './providers/provider.factory'
export * from './providers/provider.interface'
export * from './pricing/model-pricing.service'
export * from './tools/adapters/embedding.adapter'
export * from './rag/hybrid-search.service'
export * from './rag/embedding.service'
export * from './rag/embedding.types'
export * from './rag/hybrid-search.types'
export * from './rag/memory-deduplication.service'

// Providers
export * from './providers/openai.provider'

// Tools
export * from './tools/agent.tool'
export * from './tools/tool-registry'
export * from './tools/current-time.tool'
export * from './tools/diary-read.tool'
export * from './tools/diary-list.tool'
export * from './tools/diary-edit.tool'
export * from './tools/diary-delete.tool'
export * from './tools/diary-search.tool'
export * from './tools/memory-store.tool'
export * from './tools/memory-delete.tool'
export * from './tools/vector-search.tool'
export * from './tools/message-search.tool'
export * from './tools/summary-read.tool'
export * from './tools/web-search.tool'
export * from './tools/url-read.tool'
export * from './tools/search/web-content.util'
export * from './tools/search/web-search-config.util'

// Middleware
export * from './middleware/message-middleware'
export * from './middleware/gemini-thought-signature'
export * from './middleware/deepseek-reasoning'
export * from './middleware/middleware-factory'

// Agent Handlers
export * from './agent/message.adapter'
export * from './agent/stream-accumulator'
export * from './agent/stream-chunk.types'
export * from './agent/stream-chunk.adapter'
export * from './agent/agent-session.service'

// Memory & Context Engine
export * from './agent/context-window.builder'
export * from './agent/context-at-message.service'
export * from './agent/call-chain-view-model.builder'
export * from './agent/context-call-chain.builder'
export * from './agent/model-message-display.formatter'
export * from './agent/session-system-prompt.resolver'
export * from './agent/system-prompt.builder'
export * from './agent/title-generator.service'
export * from './agent/context-compressor.service'
export * from './agent/compression-lifecycle'
export * from './agent/compaction-marker'
export * from './agent/compression-round.utils'
export * from './agent/session-branch.compression'
export * from './agent/session-truncate.utils'
export {
  readPdfTextFromPath,
  readLocalFileAsBase64,
  canReadLocalPath
} from './platform/read-local-file'

export type { IStreamEmitter } from './agent/stream-emitter.interface'
export { AgentChatCoreService } from './agent/agent-chat-core.service'
export { AgentChatActionCoreRunner } from './agent/agent-chat-action-core.runner'
export type { ActionDeps, StreamRunConfig } from './agent/actions/base.action'
