import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const src = readFileSync(join(here, '..', 'index.tsx'), 'utf8')
const css = readFileSync(join(here, '..', 'IncrementalSyncPanel.module.css'), 'utf8')

describe('incremental sync panel chrome', () => {
  it('uses a lucide refresh icon and spins it while syncing', () => {
    expect(src).toContain("import { RefreshCw } from 'lucide-react'")
    expect(src).toContain('<RefreshCw')
    expect(src).toContain('styles.spinning')
    expect(css).toContain('@keyframes spin')
  })

  it('keeps the sync action as a flat titlebar button', () => {
    expect(css).toMatch(/\.syncButton \{[\s\S]*background: transparent/)
    expect(css).toMatch(/\.syncButton:hover:not\(:disabled\)[\s\S]*background:/)
  })
})
