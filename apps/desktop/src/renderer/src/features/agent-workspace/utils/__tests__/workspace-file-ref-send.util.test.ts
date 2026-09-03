import { describe, expect, it } from 'vitest'
import { mergeWorkspaceFileRefsIntoAttachments } from '../workspace-file-ref-send.util'

describe('mergeWorkspaceFileRefsIntoAttachments', () => {
  it('turns file refs into path attachments', () => {
    const merged = mergeWorkspaceFileRefsIntoAttachments({
      folderRoot: '/tmp/proj',
      fileRefs: [
        {
          relativePath: 'src/app.ts',
          selection: { startLine: 12, endLine: 20 },
          origin: 'mention'
        }
      ]
    })
    expect(merged).toEqual([
      expect.objectContaining({
        fileName: 'app.ts',
        filePath: '/tmp/proj/src/app.ts',
        relativePath: 'src/app.ts',
        isText: true,
        selection: { startLine: 12, endLine: 20 },
        origin: 'mention'
      })
    ])
  })

  it('skips paths that escape the workspace root', () => {
    expect(
      mergeWorkspaceFileRefsIntoAttachments({
        folderRoot: '/tmp/proj',
        fileRefs: [{ relativePath: '../secret.ts' }]
      })
    ).toBeUndefined()
  })

  it('skips duplicate path and selection', () => {
    const merged = mergeWorkspaceFileRefsIntoAttachments({
      folderRoot: '/tmp/proj',
      attachments: [
        {
          id: '1',
          fileName: 'app.ts',
          filePath: '/tmp/proj/src/app.ts',
          relativePath: 'src/app.ts',
          isImage: false,
          isPdf: false,
          isText: true,
          selection: { startLine: 12, endLine: 20 }
        }
      ],
      fileRefs: [{ relativePath: 'src/app.ts', selection: { startLine: 12, endLine: 20 } }]
    })
    expect(merged).toHaveLength(1)
  })
})
