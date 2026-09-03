import { describe, expect, it } from 'vitest'
import {
  classifyPromptAttachmentKind,
  isSafeWorkspaceRelativePath,
  fileContextItemKey,
  formatFileMentionLabel,
  formatFileMentionPathLabel,
  formatPromptFileAttachmentBlock,
  formatPromptUnsupportedAttachmentHint,
  looksLikeBinaryText,
  parseFileMentionToken,
  sliceTextBySelection,
  truncatePromptTextAttachment
} from '../prompt-attachment-kind.util'

describe('classifyPromptAttachmentKind', () => {
  it('treats source files as text', () => {
    expect(classifyPromptAttachmentKind('src/app.ts').isText).toBe(true)
    expect(classifyPromptAttachmentKind('data.json').isText).toBe(true)
    expect(classifyPromptAttachmentKind('main.py').isText).toBe(true)
    expect(classifyPromptAttachmentKind('notes.md').isText).toBe(true)
  })

  it('keeps images and pdf separate from text', () => {
    expect(classifyPromptAttachmentKind('shot.png')).toEqual({
      isImage: true,
      isPdf: false,
      isText: false
    })
    expect(classifyPromptAttachmentKind('brief.pdf')).toEqual({
      isImage: false,
      isPdf: true,
      isText: false
    })
  })

  it('treats text mime as text even without a known extension', () => {
    expect(classifyPromptAttachmentKind('UNLICENSE-NOTE', 'text/plain').isText).toBe(true)
  })

  it('treats dotfiles and extensionless text names as text', () => {
    expect(classifyPromptAttachmentKind('.env').isText).toBe(true)
    expect(classifyPromptAttachmentKind('.env.local').isText).toBe(true)
    expect(classifyPromptAttachmentKind('.gitignore').isText).toBe(true)
    expect(classifyPromptAttachmentKind('Makefile').isText).toBe(true)
    expect(classifyPromptAttachmentKind('Dockerfile').isText).toBe(true)
    expect(classifyPromptAttachmentKind('LICENSE').isText).toBe(true)
  })
})

describe('isSafeWorkspaceRelativePath', () => {
  it('accepts workspace files and dotfiles', () => {
    expect(isSafeWorkspaceRelativePath('src/app.ts')).toBe(true)
    expect(isSafeWorkspaceRelativePath('.env')).toBe(true)
  })

  it('rejects parent-directory segments', () => {
    expect(isSafeWorkspaceRelativePath('../secret.ts')).toBe(false)
    expect(isSafeWorkspaceRelativePath('src/../../etc/passwd')).toBe(false)
    expect(isSafeWorkspaceRelativePath('foo/./bar')).toBe(false)
  })
})

describe('looksLikeBinaryText', () => {
  it('detects null bytes', () => {
    expect(looksLikeBinaryText('hello\0world')).toBe(true)
    expect(looksLikeBinaryText('hello world')).toBe(false)
  })
})

describe('sliceTextBySelection', () => {
  it('slices inclusive 1-based line ranges', () => {
    const result = sliceTextBySelection('a\nb\nc\nd', { startLine: 2, endLine: 3 })
    expect(result).toEqual({
      text: 'b\nc',
      startLine: 2,
      endLine: 3,
      totalLines: 4
    })
  })

  it('clamps inverted and out-of-range selections', () => {
    const result = sliceTextBySelection('a\nb\nc', { startLine: 9, endLine: 2 })
    expect(result.startLine).toBe(2)
    expect(result.endLine).toBe(3)
    expect(result.text).toBe('b\nc')
  })
})

describe('truncatePromptTextAttachment', () => {
  it('keeps short files intact', () => {
    const result = truncatePromptTextAttachment('hello')
    expect(result.truncated).toBe(false)
    expect(result.text).toBe('hello')
  })
})

describe('formatPromptFileAttachmentBlock', () => {
  it('includes path, selection and comment', () => {
    const text = formatPromptFileAttachmentBlock({
      displayPath: 'src/app.ts',
      text: 'export const x = 1',
      selection: { startLine: 12, endLine: 20 },
      comment: '这里命名不好'
    })
    expect(text).toContain('用户针对 src/app.ts 第 12 至 20 行的评论：这里命名不好')
    expect(text).toContain('[User Uploaded File Attachment: src/app.ts (lines 12-20)]')
  })

  it('uses singular line wording for a one-line range', () => {
    const text = formatPromptFileAttachmentBlock({
      displayPath: 'src/app.ts',
      text: 'export const x = 1',
      selection: { startLine: 12, endLine: 12 },
      comment: '这里命名不好'
    })
    expect(text).toContain('用户针对 src/app.ts 第 12 行的评论：这里命名不好')
    expect(text).toContain('[User Uploaded File Attachment: src/app.ts (line 12)]')
    expect(text).toContain('export const x = 1')
  })
})

describe('formatPromptUnsupportedAttachmentHint', () => {
  it('names the file and explains it cannot be inlined', () => {
    expect(formatPromptUnsupportedAttachmentHint('pack.zip')).toContain('pack.zip')
    expect(formatPromptUnsupportedAttachmentHint('pack.zip')).toContain('无法直接放入对话')
  })
})

describe('file mention token', () => {
  it('parses path and optional line range', () => {
    expect(parseFileMentionToken('@src/app.ts#L12-20')).toEqual({
      relativePath: 'src/app.ts',
      selection: { startLine: 12, endLine: 20 }
    })
    expect(formatFileMentionLabel({ relativePath: 'src/app.ts' })).toBe('@app.ts')
    expect(
      formatFileMentionLabel({
        relativePath: 'src/app.ts',
        selection: { startLine: 12, endLine: 20 }
      })
    ).toBe('@app.ts#L12-20')
    expect(
      formatFileMentionLabel({
        relativePath: 'docs/月光邮局-Latte.md',
        selection: { startLine: 8, endLine: 8 }
      })
    ).toBe('@月光邮局-Latte.md#L8')
    expect(
      formatFileMentionPathLabel({
        relativePath: 'src/app.ts',
        selection: { startLine: 12, endLine: 20 }
      })
    ).toBe('@src/app.ts#L12-20')
  })

  it('builds a stable context key', () => {
    expect(
      fileContextItemKey({
        relativePath: 'src/app.ts',
        selection: { startLine: 12, endLine: 20 },
        comment: 'x'
      })
    ).toBe('file:src/app.ts:12:20:c=x')
  })
})
