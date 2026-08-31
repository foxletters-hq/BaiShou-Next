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

export function shouldShowMemoryOnboarding(input: {
  dismissed: boolean
  embeddingConfigured: boolean
  unindexedDiaryCount: number
  pendingGraphCount: number
}): boolean {
  if (input.dismissed) return false
  if (input.embeddingConfigured && input.unindexedDiaryCount <= 0 && input.pendingGraphCount <= 0) {
    return false
  }
  return true
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
