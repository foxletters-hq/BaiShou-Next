import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const dir = dirname(fileURLToPath(import.meta.url))
const page = readFileSync(join(dir, '..', 'DiaryPage.tsx'), 'utf8')
const hook = readFileSync(join(dir, '..', 'hooks', 'useDiaryData.ts'), 'utf8')

describe('diary first paint secondary load', () => {
  it('should mark the list ready only after the first list request finishes', () => {
    expect(hook).toContain('hasLoadedOnce')
    expect(hook).toContain('setHasLoadedOnce(true)')
    expect(hook).toContain('return { entries, totalCount, loading, loadEntries, hasLoadedOnce }')
  })

  it('should wait for the first list paint before status bar, today entry and attachment dir', () => {
    expect(page).toContain('hasLoadedOnce')
    expect(page).toMatch(/if \(!hasLoadedOnce\) return[\s\S]*refreshStatusBar/)
    expect(page).toMatch(/if \(!hasLoadedOnce\) return[\s\S]*findByDate/)
    expect(page).toMatch(/if \(!hasLoadedOnce \|\| !selectedMonth\) return[\s\S]*getAttachmentDir/)
    expect(page).toContain('prefetchWorkbenchHome')
  })
})
