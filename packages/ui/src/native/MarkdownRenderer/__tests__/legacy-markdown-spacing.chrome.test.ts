import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'LegacyMarkdownRenderer.tsx'),
  'utf8'
)

describe('LegacyMarkdownRenderer spacing chrome', () => {
  it('should provide paragraph spacing and trim trailing block margin', () => {
    // 确保使用统一的 markdownSpacingTokens 而非散落的硬编码
    expect(src).toContain('markdownSpacingTokens.paragraph')
    expect(src).toContain('markdownSpacingTokens.headings')
    expect(src).not.toContain('isChat ? 0 : 8')

    // 确保包含末尾块下边距修剪逻辑
    expect(src).toContain('isLastBlockChild')
    expect(src).toContain('lastBlock: {')
    expect(src).toContain('marginBottom: 0')
  })

  it('should not use harsh bgSurfaceHighest for text surfaces and add blockquote radius', () => {
    // 确保正文内的引用、行内代码、代码块不使用黑沉沉的 bgSurfaceHighest
    expect(src).not.toContain('colors.bgSurfaceHighest')
    expect(src).toContain('borderTopRightRadius: sharedTokens.radius.sm')
    expect(src).toContain('borderBottomRightRadius: sharedTokens.radius.sm')
  })
})
