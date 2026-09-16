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
})
