import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

function readSection(fileName: string): string {
  return readFileSync(join(here, '..', fileName), 'utf8')
}

describe('mobile rag memory searching', () => {
  it('shows a searching flag when switching category or query', () => {
    const view = readSection('RAGMemorySectionView.tsx')
    const actions = readSection('useRagMemoryActions.ts')
    const data = readSection('useRagMemoryData.ts')
    expect(view).toContain('isSearching={isSearching}')
    expect(actions).toContain('invalidateInFlightQuery()')
    expect(actions).toContain('handleSourceKindChange')
    expect(data).toContain('setIsSearching(true)')
    expect(data).toContain('setIsSearching(false)')
  })

  it('should send suspect review to the graph pending tab', () => {
    const view = readSection('RAGMemorySectionView.tsx')
    expect(view).toContain('useMobileSuspectCount')
    expect(view).toContain('requestGraphPendingFocus')
    expect(view).toContain('suspectCount={suspectCount}')
    expect(view).toContain("router.push('/graph')")
  })
})
