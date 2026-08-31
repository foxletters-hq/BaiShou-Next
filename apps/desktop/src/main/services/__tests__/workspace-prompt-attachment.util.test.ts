import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  decorateWorkspacePromptAttachment,
  planWorkspacePromptAttachment,
  workspaceRelativeFromFolder
} from '../workspace-prompt-attachment.util'

describe('workspaceRelativeFromFolder', () => {
  it('returns posix relative path for files inside the workspace', () => {
    expect(
      workspaceRelativeFromFolder('D:\\Projects\\invoice', 'D:\\Projects\\invoice\\docs\\brief.pdf')
    ).toBe('docs/brief.pdf')
  })

  it('returns undefined for files outside the workspace', () => {
    expect(
      workspaceRelativeFromFolder('D:\\Projects\\invoice', 'C:\\Users\\me\\Desktop\\brief.pdf')
    ).toBeUndefined()
  })
})

describe('planWorkspacePromptAttachment', () => {
  it('keeps picked documents as path refs', () => {
    expect(
      planWorkspacePromptAttachment({
        filePath: 'C:\\Users\\me\\Desktop\\brief.pdf',
        fileName: 'brief.pdf'
      })
    ).toEqual({
      mode: 'path-ref',
      absolutePath: 'C:\\Users\\me\\Desktop\\brief.pdf',
      fileName: 'brief.pdf'
    })
    expect(
      planWorkspacePromptAttachment({
        filePath: 'D:\\Projects\\invoice\\notes.md',
        fileName: 'notes.md'
      })
    ).toMatchObject({ mode: 'path-ref' })
  })

  it('snapshots picked images instead of referencing the original path', () => {
    expect(
      planWorkspacePromptAttachment({
        filePath: 'C:\\Users\\me\\Desktop\\截图.png',
        fileName: '截图.png'
      })
    ).toEqual({
      mode: 'image-snapshot',
      absolutePath: 'C:\\Users\\me\\Desktop\\截图.png',
      fileName: '截图.png'
    })
  })

  it('treats clipboard bytes as ephemeral', () => {
    expect(
      planWorkspacePromptAttachment({
        data: 'data:application/pdf;base64,AAA',
        filePath: 'blob:abc',
        fileName: 'pasted.pdf'
      })
    ).toEqual({ mode: 'ephemeral' })
  })
})

describe('decorateWorkspacePromptAttachment', () => {
  it('stores the original path instead of a copied vault name', () => {
    const att = decorateWorkspacePromptAttachment({
      absolutePath: path.join('D:', 'Projects', 'invoice', 'docs', 'brief.pdf'),
      fileName: 'brief.pdf',
      folderRoot: path.join('D:', 'Projects', 'invoice')
    })
    expect(att.fileName).toBe('brief.pdf')
    expect(String(att.filePath)).toContain('brief.pdf')
    expect(att.relativePath).toBe('docs/brief.pdf')
    expect(att.isPdf).toBe(true)
    expect(att.data).toBeUndefined()
  })
})
