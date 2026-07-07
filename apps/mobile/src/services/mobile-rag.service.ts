export { MobileRagAbortError } from './mobile-rag-operation-control'
export {
  embedDiaryEntry,
  type EmbedDiaryEntryParams,
  type EmbedDiaryEntryOptions,
  type MobileRagServiceDeps,
  type RagProgressCallback,
  type ControlledDiaryBatchEmbedResult
} from './mobile-rag-core.helpers'
export { runControlledDiaryBatchEmbed } from './mobile-rag-batch-embed.helpers'
export {
  isMobileRagReembedInFlight,
  requestDeferredPostSyncEmbed,
  isDeferredPostSyncEmbedPending,
  resetMobileRagBatchStateForTests
} from './mobile-rag-state.helpers'
import { createMobileRagService } from './mobile-rag-service-impl.helpers'

export type MobileRagService = ReturnType<typeof createMobileRagService>

export { createMobileRagService }
