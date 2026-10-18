import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const dir = dirname(fileURLToPath(import.meta.url))
const markdownTheme = readFileSync(join(dir, '../theme/editor-theme-markdown.ts'), 'utf8')
const headingSyntax = readFileSync(join(dir, '../extensions/buildLineSyntax.ts'), 'utf8')

describe('diary tag token font', () => {
  it('should pin tag chips to the editor reading size with a px fallback', () => {
    expect(markdownTheme).toMatch(
      /'\.cm-diary-tag-token'\s*:\s*\{[^}]*fontSize:\s*'var\(--content-font-size-lg, 16px\)'/s
    )
    expect(markdownTheme).not.toMatch(
      /'\.cm-diary-tag-token'\s*:\s*\{[^}]*fontSize:\s*'var\(--ui-fs-xl\)'/s
    )
  })

  it('should still treat #tag without a space as an ATX heading prefix', () => {
    expect(headingSyntax).toMatch(/ATX_HEADING_PREFIX_RE\s*=\s*\/\^\(#\{1,6\}\)\\s\?\//)
  })
})
