import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const dir = dirname(fileURLToPath(import.meta.url))
const viewer = readFileSync(join(dir, '../GitDiffViewer.tsx'), 'utf8')
const css = readFileSync(join(dir, '../GitDiffViewer.module.css'), 'utf8')
const page = readFileSync(join(dir, '../GitManagementPage.tsx'), 'utf8')

describe('git diff viewer auto wrap', () => {
  it('should wrap long unified diff rows in the version control main preview', () => {
    expect(page).toMatch(/<GitDiffViewer[^>]*autoWrap/)
    expect(viewer).toContain('autoWrap?: boolean')
    expect(viewer).toContain('styles.unifiedWrap')
    expect(css).toMatch(/\.unifiedWrap \.unifiedContent\s*\{[^}]*width:\s*100%/s)
    expect(css).toMatch(/\.unifiedWrap \.unifiedRow\s*\{[^}]*minmax\(0,\s*1fr\)/s)
    expect(css).toMatch(
      /\.unifiedWrap \.lineText,\s*\.unifiedWrap \.hunkText\s*\{[^}]*white-space:\s*pre-wrap[^}]*overflow-wrap:\s*anywhere/s
    )
  })
})
