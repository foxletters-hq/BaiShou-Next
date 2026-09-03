import { describe, expect, it } from 'vitest'
import { resolveUserFileDisplay, splitTextByFileRefs } from '../file-cite.util'

describe('file-cite.util', () => {
  it('splits basename labels with a line range', () => {
    expect(
      splitTextByFileRefs('看一下 @app.ts#L12-20 这里', [
        { relativePath: 'src/app.ts', selection: { startLine: 12, endLine: 20 } }
      ])
    ).toEqual([
      { type: 'text', value: '看一下 ' },
      {
        type: 'file',
        relativePath: 'src/app.ts',
        selection: { startLine: 12, endLine: 20 },
        comment: undefined,
        origin: undefined
      },
      { type: 'text', value: ' 这里' }
    ])
  })

  it('also recognizes legacy full-path labels', () => {
    const segments = splitTextByFileRefs('对照 @src/app.ts', [{ relativePath: 'src/app.ts' }])
    expect(segments.some((seg) => seg.type === 'file' && seg.relativePath === 'src/app.ts')).toBe(
      true
    )
  })

  it('prepends chips when the body has no label', () => {
    const resolved = resolveUserFileDisplay('你能看到这个吗', [
      { relativePath: 'docs/月光邮局-Latte.md', selection: { startLine: 8, endLine: 20 } }
    ])
    expect(resolved.segments[0]).toMatchObject({
      type: 'file',
      relativePath: 'docs/月光邮局-Latte.md',
      selection: { startLine: 8, endLine: 20 }
    })
    expect(resolved.segments[1]).toEqual({ type: 'text', value: '你能看到这个吗' })
    expect(resolved.text).toContain('@月光邮局-Latte.md#L8-20')
  })

  it('drops unsafe relative paths', () => {
    expect(
      resolveUserFileDisplay('x', [{ relativePath: '../secret.ts' }]).fileRefs
    ).toEqual([])
  })
})
