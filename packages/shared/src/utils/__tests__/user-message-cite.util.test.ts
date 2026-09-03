import { describe, expect, it } from 'vitest'
import { resolveUserComposerCites } from '../user-message-cite.util'

describe('resolveUserComposerCites', () => {
  it('keeps skill chips and splits file labels in the remaining text', () => {
    const resolved = resolveUserComposerCites(
      '/writer 看一下 @app.ts#L12 这里',
      [{ command: 'writer', content: '先看目录' }],
      [{ relativePath: 'src/app.ts', selection: { startLine: 12, endLine: 12 } }]
    )
    expect(resolved.hasCite).toBe(true)
    expect(resolved.segments.map((seg) => seg.type)).toEqual(['skill', 'text', 'file', 'text'])
    expect(resolved.segments[2]).toMatchObject({
      type: 'file',
      relativePath: 'src/app.ts',
      selection: { startLine: 12, endLine: 12 }
    })
  })

  it('prepends file chips when only attachments existed', () => {
    const resolved = resolveUserComposerCites('你能看到这个吗', [], [
      { relativePath: 'docs/月光邮局-Latte.md' }
    ])
    expect(resolved.segments[0]).toMatchObject({
      type: 'file',
      relativePath: 'docs/月光邮局-Latte.md'
    })
    expect(resolved.segments[1]).toEqual({ type: 'text', value: '你能看到这个吗' })
  })
})
