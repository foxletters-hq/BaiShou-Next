import { describe, expect, it, vi } from 'vitest'
import { WORKBENCH_EXPLORER_DND_MIME } from '../../workbench/workbench-file-explorer-dnd.util'
import {
  attachmentFromWorkspaceFilePath,
  joinWorkspaceAbsolutePath,
  resolveWorkspaceComposerDrop
} from '../workspace-composer-drop.util'

function mockExplorerTransfer(relativePaths: string[]): DataTransfer {
  return {
    getData: (type: string) =>
      type === WORKBENCH_EXPLORER_DND_MIME ? JSON.stringify({ relativePaths }) : ''
  } as unknown as DataTransfer
}

describe('workspace-composer-drop.util', () => {
  it('joins posix and windows folder roots', () => {
    expect(joinWorkspaceAbsolutePath('/tmp/proj', 'docs/a.md')).toBe('/tmp/proj/docs/a.md')
    expect(joinWorkspaceAbsolutePath('D:\\proj', 'docs/a.md')).toBe('D:\\proj\\docs\\a.md')
  })

  it('refuses parent-directory segments', () => {
    expect(joinWorkspaceAbsolutePath('/tmp/proj', '../secret.ts')).toBe('')
    expect(joinWorkspaceAbsolutePath('/tmp/proj', 'src/../../outside.ts')).toBe('')
  })

  it('classifies workspace file attachments from path', () => {
    expect(attachmentFromWorkspaceFilePath({ absolutePath: '/tmp/a.png', fileName: 'a.png' }).isImage).toBe(
      true
    )
    expect(attachmentFromWorkspaceFilePath({ absolutePath: '/tmp/a.pdf', fileName: 'a.pdf' }).isPdf).toBe(
      true
    )
    expect(attachmentFromWorkspaceFilePath({ absolutePath: '/tmp/a.md', fileName: 'a.md' }).isText).toBe(true)
    expect(attachmentFromWorkspaceFilePath({ absolutePath: '/tmp/a.ts', fileName: 'a.ts' }).isText).toBe(true)
  })

  it('returns null for ordinary OS file drops', async () => {
    const dt = { getData: () => '' } as unknown as DataTransfer
    await expect(
      resolveWorkspaceComposerDrop({ dataTransfer: dt, folderRoot: '/tmp/proj' })
    ).resolves.toBeNull()
  })

  it('returns empty when explorer drop has no folder root', async () => {
    await expect(
      resolveWorkspaceComposerDrop({
        dataTransfer: mockExplorerTransfer(['docs/a.md']),
        folderRoot: null
      })
    ).resolves.toEqual([])
  })

  it('skips directories and keeps files', async () => {
    const listDir = vi.fn(async () => [
      { relativePath: 'docs', name: 'docs', isDirectory: true },
      { relativePath: 'docs/a.md', name: 'a.md', isDirectory: false }
    ])
    const result = await resolveWorkspaceComposerDrop({
      dataTransfer: mockExplorerTransfer(['docs', 'docs/a.md']),
      folderRoot: '/tmp/proj',
      listDir
    })
    expect(result).toEqual([
      expect.objectContaining({
        fileName: 'a.md',
        filePath: '/tmp/proj/docs/a.md',
        isText: true
      })
    ])
  })
})
