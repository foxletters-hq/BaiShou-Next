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

export function resolveMemoryOnboardingLaunch(input: {
  embeddingConfigured: boolean
  unindexedDiaryCount?: number
  pendingEmbedCount?: number
  pendingGraphCount: number
}): MemoryOnboardingLaunch {
  if (!input.embeddingConfigured) return 'configure'
  const index = memoryOnboardingEmbedBacklog(input) > 0
  const organize = input.pendingGraphCount > 0
  if (index && organize) return 'index-and-organize'
  if (index) return 'index'
  return 'organize'
}

export type MemoryOrganizeAction = 'configure' | 'embed-then-graph' | 'graph'

/** 记忆中心「开始整理记忆」：未配置嵌入模型先去配置，否则先补齐嵌入再整理图谱。 */
export function resolveMemoryOrganizeAction(input: {
  embeddingConfigured: boolean
  unindexedDiaryCount?: number
  pendingEmbedCount?: number
  indexing?: boolean
}): MemoryOrganizeAction {
  if (!input.embeddingConfigured) return 'configure'
  if (input.indexing) return 'embed-then-graph'
  return memoryOnboardingEmbedBacklog(input) > 0 ? 'embed-then-graph' : 'graph'
}

export function readMemoryOnboardingDismissed(): boolean {
  try {
    return localStorage.getItem(MEMORY_ONBOARDING_DISMISSED_KEY) === '1'
  } catch {
    return false
  }
}

export function persistMemoryOnboardingDismissed(): void {
  localStorage.setItem(MEMORY_ONBOARDING_DISMISSED_KEY, '1')
}
