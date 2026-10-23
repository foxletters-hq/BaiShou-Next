export const MEMORY_CENTER_TABS = ['vectors', 'graph'] as const

export type MemoryCenterTab = (typeof MEMORY_CENTER_TABS)[number]

export const MEMORY_ONBOARDING_DISMISSED_KEY = 'baishou.memory.onboardingDismissed.v1'

export function isMemoryCenterTab(value: string): value is MemoryCenterTab {
  return (MEMORY_CENTER_TABS as readonly string[]).includes(value)
}

export function memoryCenterTabFromPath(pathname: string): MemoryCenterTab {
  const trimmed = pathname.trim()
  if (trimmed === '/memory' || trimmed === '/memory/') return 'vectors'
  if (trimmed === '/memory/vectors' || trimmed.startsWith('/memory/vectors/')) return 'vectors'
  if (trimmed === '/memory/graph' || trimmed.startsWith('/memory/graph/')) return 'graph'
  const segment = trimmed.replace(/^\/memory\/?/, '').split('/')[0] ?? ''
  return isMemoryCenterTab(segment) ? segment : 'vectors'
}

export function memoryCenterPathForTab(tab: MemoryCenterTab): string {
  return tab === 'vectors' ? '/memory/vectors' : '/memory/graph'
}

export type MemoryOnboardingStepId = 'embed' | 'vector' | 'graph'
export type MemoryOnboardingStepStatus = 'done' | 'todo' | 'blocked'
export type MemoryOnboardingPrimaryKind = 'configure' | 'start'
export type MemoryOnboardingLaunch = 'configure' | 'index' | 'organize' | 'index-and-organize'

export type MemoryOnboardingStep = {
  id: MemoryOnboardingStepId
  status: MemoryOnboardingStepStatus
  count?: number
}

function memoryOnboardingEmbedBacklog(input: {
  unindexedDiaryCount?: number
  pendingEmbedCount?: number
}): number {
  return Math.max(input.pendingEmbedCount ?? 0, input.unindexedDiaryCount ?? 0)
}

export function shouldShowMemoryOnboarding(input: {
  dismissed: boolean
  embeddingConfigured: boolean
  unindexedDiaryCount?: number
  pendingEmbedCount?: number
  pendingGraphCount: number
}): boolean {
  if (input.dismissed) return false
  const embedBacklog = memoryOnboardingEmbedBacklog(input)
  if (input.embeddingConfigured && embedBacklog <= 0 && input.pendingGraphCount <= 0) {
    return false
  }
  return true
}

export function buildMemoryOnboardingModel(input: {
  embeddingConfigured: boolean
  unindexedDiaryCount?: number
  pendingEmbedCount?: number
  pendingGraphCount: number
}): {
  steps: MemoryOnboardingStep[]
  primaryKind: MemoryOnboardingPrimaryKind
} {
  const embedBacklog = memoryOnboardingEmbedBacklog(input)
  const embedDone = input.embeddingConfigured
  const vectorPending = embedBacklog > 0
  const graphPending = input.pendingGraphCount > 0
  return {
    steps: [
      { id: 'embed', status: embedDone ? 'done' : 'todo' },
      {
        id: 'vector',
        status: !embedDone ? 'blocked' : vectorPending ? 'todo' : 'done',
        count: embedBacklog
      },
      {
        id: 'graph',
        status: !embedDone ? 'blocked' : graphPending ? 'todo' : 'done',
        count: input.pendingGraphCount
      }
    ],
    primaryKind: embedDone ? 'start' : 'configure'
  }
}

export type MemoryOrganizeAction = 'configure' | 'embed-then-graph' | 'graph'

export type MemoryOrganizeConfigurePrompt = {
  toastKey:
    | 'memory.need_models_to_organize'
    | 'memory.need_embedding_to_organize'
    | 'memory.need_extract_to_organize'
  picker: 'embedding' | 'extract'
}

export function resolveMemoryOrganizeAction(input: {
  embeddingConfigured: boolean
  /** 未传时不拦图抽取槽位，兼容旧调用 */
  extractConfigured?: boolean
  unindexedDiaryCount?: number
  pendingEmbedCount?: number
  indexing?: boolean
}): MemoryOrganizeAction {
  if (!input.embeddingConfigured) return 'configure'
  if (input.extractConfigured === false) return 'configure'
  if (input.indexing) return 'embed-then-graph'
  return memoryOnboardingEmbedBacklog(input) > 0 ? 'embed-then-graph' : 'graph'
}

/** 整理前缺模型时的提示与选择器：两个都缺先配嵌入，只缺一个就打开对应槽位 */
export function resolveMemoryOrganizeConfigurePrompt(input: {
  embeddingConfigured: boolean
  extractConfigured: boolean
}): MemoryOrganizeConfigurePrompt | null {
  if (input.embeddingConfigured && input.extractConfigured) return null
  if (!input.embeddingConfigured && !input.extractConfigured) {
    return { toastKey: 'memory.need_models_to_organize', picker: 'embedding' }
  }
  if (!input.embeddingConfigured) {
    return { toastKey: 'memory.need_embedding_to_organize', picker: 'embedding' }
  }
  return { toastKey: 'memory.need_extract_to_organize', picker: 'extract' }
}
