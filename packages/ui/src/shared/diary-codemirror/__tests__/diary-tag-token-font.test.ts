import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const dir = dirname(fileURLToPath(import.meta.url))
const markdownTheme = readFileSync(join(dir, '../theme/editor-theme-markdown.ts'), 'utf8')
const baseTheme = readFileSync(join(dir, '../theme/editor-theme-base.ts'), 'utf8')
const headingSyntax = readFileSync(join(dir, '../extensions/buildLineSyntax.ts'), 'utf8')

describe('diary tag token font', () => {
  it('should use the reading body font size token on the editor root', () => {
    expect(baseTheme).toMatch(
      /'&\.cm-editor'\s*:\s*\{[^}]*fontSize:\s*'var\(--content-font-size-lg, 16px\)'/s
    )
  })

  it('should keep blockquotes at the inherited body size', () => {
    expect(baseTheme).toMatch(
      /'\.cm-line\.cm-rendered-blockquote'\s*:\s*\{[^}]*fontSize:\s*'inherit'/s
    )
  })

  it('should render inline code with Obsidian-like mono font and slightly smaller size', () => {
    expect(baseTheme).toMatch(
      /'\.cm-rendered-inline-code'\s*:\s*\{[^}]*fontFamily:\s*'var\(--font-family-mono/s
    )
    expect(baseTheme).toMatch(/'\.cm-rendered-inline-code'\s*:\s*\{[^}]*fontSize:\s*'0\.9em'/s)
  })

  it('should keep tag chips at the same font size as body text', () => {
    expect(markdownTheme).toMatch(/'\.cm-diary-tag-token'\s*:\s*\{[^}]*fontSize:\s*'inherit'/s)
    expect(markdownTheme).not.toMatch(
      /'\.cm-diary-tag-token'\s*:\s*\{[^}]*fontSize:\s*'var\(--content-font-size-lg/s
    )
  })

  it('should not treat #tag without a space as an ATX heading prefix', () => {
    expect(headingSyntax).toMatch(/ATX_HEADING_PREFIX_RE\s*=\s*\/\^\(#\{1,6\}\)\(\?:\\s\+\|\$\)\//)
  })
})
