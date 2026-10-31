import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(join(here, '../Dialog.tsx'), 'utf8')

describe('native Dialog actions chrome', () => {
  it('should use compact right-aligned buttons instead of stretching them full width', () => {
    expect(source).toContain('modalActionsStyle')
    expect(source).toContain('size="sm"')
    expect(source).not.toContain('style={{ flex: 1 }}')
    expect(source).not.toContain("style={state.type === 'alert' ? { width: '100%' } : { flex: 1 }}")
  })

  it('should inset the choose-list scroll indicator like SkillCitePreviewDialog', () => {
    expect(source).toContain('paddingRight: sharedTokens.spacing.mdTight')
    expect(source).toContain('keyboardShouldPersistTaps="handled"')
  })

  it('should support large input box and content placeholder for multiline prompts', () => {
    expect(source).toContain("t('common.input_content', '请输入内容')")
    expect(source).toContain('state.numberOfLines ?? 6')
    expect(source).toContain('minHeight: 140')
    expect(source).toContain('maxHeight: 220')
    expect(source).toContain("textAlignVertical: 'top'")
    expect(source).toContain('title={state.title}')
  })
})
