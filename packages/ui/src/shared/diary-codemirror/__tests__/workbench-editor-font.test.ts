import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const dir = dirname(fileURLToPath(import.meta.url))
const theme = readFileSync(join(dir, '../theme/workbenchEditorTheme.ts'), 'utf8')
const mergeDiff = readFileSync(
  join(dir, '../../../agent-workspace/FileChangeMergeDiff.tsx'),
  'utf8'
)
const cssVariables = readFileSync(join(dir, '../../../theme/css-variables.css'), 'utf8')
const gitDiffCss = readFileSync(
  join(dir, '../../../desktop/GitManagementPage/GitDiffViewer.module.css'),
  'utf8'
)

describe('workbench editor font', () => {
  it('should cap merge-diff and chrome editors at the sidebar content token', () => {
    expect(theme).toMatch(/'&\.workbench-cm-editor'\s*:\s*\{[^}]*fontSize:\s*'var\(--ui-fs-md\)'/s)
    expect(theme).toMatch(
      /'&\.workbench-cm-editor \.cm-line\.cm-rendered-h1'\s*:\s*\{[^}]*fontSize:\s*'inherit'/s
    )
    expect(theme).toMatch(
      /'&\.workbench-cm-editor \.cm-line\.cm-rendered-h2'\s*:\s*\{[^}]*fontSize:\s*'inherit'/s
    )
    expect(theme).toMatch(
      /'&\.workbench-cm-editor \.cm-line\.cm-rendered-h3'\s*:\s*\{[^}]*fontSize:\s*'inherit'/s
    )
    expect(theme).toMatch(
      /'&\.workbench-cm-editor \.cm-line\.cm-rendered-h4, &\.workbench-cm-editor \.cm-line\.cm-rendered-h5, &\.workbench-cm-editor \.cm-line\.cm-rendered-h6'\s*:\s*\{[^}]*fontSize:\s*'inherit'/s
    )
    expect(mergeDiff).toMatch(/fontSize:\s*'var\(--ui-fs-md\)'/)
  })

  it('should use reading-size tokens and line-level heading scale on the document editor', () => {
    expect(theme).toMatch(
      /'&\.workbench-cm-editor\.workbench-cm-doc'\s*:\s*\{[^}]*fontSize:\s*'var\(--content-font-size-md\)'/s
    )
    expect(theme).toMatch(
      /workbench-cm-doc \.cm-line\.cm-rendered-h1'\s*:\s*\{[^}]*fontSize:\s*'1\.\d+em'/s
    )
    expect(theme).toMatch(
      /workbench-cm-doc \.cm-line\.cm-rendered-h2'\s*:\s*\{[^}]*fontSize:\s*'1\.\d+em'/s
    )
    expect(theme).toMatch(
      /workbench-cm-doc \.cm-line\.cm-rendered-h3'\s*:\s*\{[^}]*fontSize:\s*'1\.\d+em'/s
    )
  })

  it('should keep the properties card background when the active line is inside it', () => {
    expect(theme).toMatch(
      /'&\.workbench-cm-editor \.cm-activeLine\.cm-wb-properties'\s*:\s*\{[^}]*backgroundColor:\s*'color-mix\(in srgb, var\(--text-primary\)/s
    )
  })

  it('should not paint a primary wash on the active line when a document opens', () => {
    expect(theme).toMatch(
      /'&\.workbench-cm-editor \.cm-activeLine'\s*:\s*\{[^}]*transparent !important'/s
    )
    expect(theme).not.toMatch(
      /'&\.workbench-cm-editor \.cm-activeLine'\s*:\s*\{[^}]*--color-primary/s
    )
  })

  it('should keep merge-diff scroller on the source-han family so CJK does not fall to system serif', () => {
    expect(mergeDiff).toMatch(
      /fontFamily:\s*'var\(--font-family-main, var\(--font-family, inherit\)\)'/
    )
  })

  it('should put the CJK family before generic monospace so Diff Chinese stays source-han', () => {
    const monoBlock = cssVariables.match(/--font-family-mono:\s*([^;]+);/s)?.[1] ?? ''
    const cjkIndex = monoBlock.indexOf('var(--font-family)')
    const genericIndex = monoBlock.search(/ui-monospace|\bmonospace\b/)
    expect(cssVariables).toContain("'Noto Sans SC'")
    expect(cjkIndex).toBeGreaterThan(-1)
    expect(genericIndex).toBeGreaterThan(-1)
    expect(cjkIndex).toBeLessThan(genericIndex)
  })

  it('should not italicize git diff empty copy because source-han has no italic face', () => {
    expect(gitDiffCss).not.toMatch(/\.empty\s*\{[^}]*font-style:\s*italic/s)
  })
})
