import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const dir = dirname(fileURLToPath(import.meta.url))
const explorerCss = readFileSync(join(dir, '../WorkbenchFileExplorer.module.css'), 'utf8')
const paneCss = readFileSync(join(dir, '../WorkbenchMainPane.module.css'), 'utf8')

describe('workbench explorer chrome', () => {
  it('should disable native text selection on file rows when a file is opened', () => {
    expect(explorerCss).toMatch(/\.row\s*\{[^}]*user-select:\s*none/s)
    expect(explorerCss).toMatch(/\.nameBtn\s*\{[^}]*user-select:\s*none/s)
  })

  it('should disable native text selection on editor tabs', () => {
    expect(paneCss).toMatch(/\.tab\s*\{[^}]*user-select:\s*none/s)
  })
})
