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
    const actions = [
      readSection('useRagMemoryActions.ts'),
      readSection('rag-memory-clear.util.ts')
    ].join('\n')
    const data = readSection('useRagMemoryData.ts')
    expect(view).toContain('isSearching={isSearching}')
    expect(actions).toContain('invalidateInFlightQuery()')
    expect(actions).toContain('handleSourceKindChange')
    expect(data).toContain('setIsSearching(true)')
    expect(data).toContain('setIsSearching(false)')
  })

  it('should clear memory by selected kinds instead of wiping everything', () => {
    const view = readSection('RAGMemorySectionView.tsx')
    const actions = [
      readSection('useRagMemoryActions.ts'),
      readSection('rag-memory-clear.util.ts')
    ].join('\n')
    const helper = readFileSync(
      join(here, '../../../../../services/mobile-rag-memory-write.helpers.ts'),
      'utf8'
    )
    expect(view).toContain('MemoryClearKindsModal')
    expect(actions).toContain('clearKinds')
    expect(actions).toContain('mobileClearLifeGraph')
    expect(helper).toContain('clearMobileRagByKinds')
    expect(helper).toContain('shouldTombstoneMemoryRecord')
  })

  it('should stop organize and wipe the life graph instead of skipping it', () => {
    const clear = readSection('rag-memory-clear.util.ts')
    expect(clear).toContain('requestOperationAbort')
    expect(clear).toContain('stopAndDropPersisted')
    expect(clear).toContain('graph.clear_life_unavailable')
    expect(clear.indexOf('requestOperationAbort')).toBeLessThan(
      clear.indexOf("kinds.includes('life_graph')")
    )
    expect(clear.indexOf('stopAndDropPersisted')).toBeLessThan(
      clear.indexOf('mobileClearLifeGraph')
    )
    expect(clear).not.toContain('mobileGraphExtractQueue.stop()')
  })

  it('should keep the confirm phrase above the keyboard by scrolling kinds only', () => {
    const modal = readSection('MemoryClearKindsModal.tsx')
    expect(modal).toContain('ScrollView')
    expect(modal).toContain('keyboardShouldPersistTaps="handled"')
    expect(modal).toContain('paddingRight: tokens.spacing.mdTight')
    expect(modal.indexOf('<ScrollView')).toBeLessThan(modal.indexOf('<Input'))
    expect(modal.indexOf('</ScrollView>')).toBeLessThan(modal.indexOf('<Input'))
  })

  it('should send suspect review to the graph pending tab', () => {
    const view = readSection('RAGMemorySectionView.tsx')
    expect(view).toContain('useMobileSuspectCount')
    expect(view).toContain('requestGraphPendingFocus')
    expect(view).toContain('suspectCount={suspectCount}')
    expect(view).toContain("router.push('/graph')")
  })

  it('should hide vector stats chips when the memory center asks for it', () => {
    const view = readSection('RAGMemorySectionView.tsx')
    expect(view).toContain('hideStats')
    expect(view).toContain('hideStats={hideStats}')
  })

  it('should pass compact chrome and settings lead into the rag view', () => {
    const view = readSection('RAGMemorySectionView.tsx')
    expect(view).toContain('compactChrome')
    expect(view).toContain('compactChrome={compactChrome}')
    expect(view).toContain('settingsLead')
    expect(view).toContain('settingsLead={settingsLead}')
  })

  it('should detect embedding dimension after the embedding model is selected', () => {
    const actions = readSection('useRagMemoryActions.ts')
    expect(actions).toContain('handleSelectEmbeddingModel')
    expect(actions).toContain('detectDimension')
  })

  it('should reload vector stats after organize pending counts change', () => {
    const data = readSection('useRagMemoryData.ts')
    expect(data).toContain('subscribeMobilePendingEmbedCountsChanged')
    expect(data).toContain('void loadRagDataRef.current()')
  })

  it('should prompt for manual memory content with add title and multiline editor', () => {
    const actions = readSection('useRagMemoryActions.ts')
    expect(actions).toContain("t('settings.rag_add_manual', '添加手动记忆片段')")
    expect(actions).toContain("t('settings.rag_edit_manual', '编辑记忆内容')")
    expect(actions).not.toMatch(
      /handleAddManualMemory\s*=\s*async\s*\(\)\s*=>\s*\{\s*const text = await dialog\.prompt\(\s*t\('settings\.rag_edit_manual'\)/
    )
  })
})
