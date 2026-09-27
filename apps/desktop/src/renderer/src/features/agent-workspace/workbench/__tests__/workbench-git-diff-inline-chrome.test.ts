import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const dir = dirname(fileURLToPath(import.meta.url))
const gitDiff = readFileSync(join(dir, '..', 'WorkbenchGitEditableDiff.tsx'), 'utf8')
const gitDiffCss = readFileSync(join(dir, '..', 'WorkbenchGitEditableDiff.module.css'), 'utf8')
const editorContent = readFileSync(join(dir, '..', 'WorkbenchEditorContent.tsx'), 'utf8')
const mainPaneCss = readFileSync(join(dir, '..', 'WorkbenchMainPane.module.css'), 'utf8')

describe('workbench git diff inline chrome', () => {
  it('should render git working-copy and revision diffs with an inline merge view', () => {
    expect(gitDiff).toContain('FileChangeMergeDiff')
    expect(gitDiff).toContain('viewMode="inline"')
    expect(gitDiff).not.toContain('diff_original')
    expect(gitDiff).not.toContain('grid-template-columns: 1fr 1fr')
    expect(gitDiffCss).not.toMatch(/grid-template-columns:\s*1fr 1fr/)
  })

  it('should keep chrome copy on the source-han stack and not italicize empty states', () => {
    expect(gitDiffCss).toMatch(/\.hint\s*\{[^}]*font-family:\s*var\(--font-family\)/s)
    expect(gitDiffCss).not.toContain('font-style: italic')
    expect(mainPaneCss).toMatch(/\.diffHeader\s*\{[^}]*font-family:\s*var\(--font-family\)/s)
  })

  it('should open fileDiff tabs in unified mode without a split default', () => {
    expect(editorContent).toContain('defaultMode="unified"')
    expect(editorContent).not.toContain('defaultMode="split"')
  })
})
