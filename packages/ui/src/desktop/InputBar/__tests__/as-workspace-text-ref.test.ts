import { describe, expect, it } from 'vitest'
import { asWorkspaceTextRef } from '../useInputBarAttachments'

describe('asWorkspaceTextRef', () => {
  it('should promote a dropped folder to a directory file ref', () => {
    expect(
      asWorkspaceTextRef({
        id: '1',
        fileName: '设定',
        filePath: '/tmp/proj/设定',
        relativePath: '设定',
        isImage: false,
        isPdf: false,
        isText: false,
        isDirectory: true,
        origin: 'explorer-drop'
      })
    ).toEqual({
      relativePath: '设定',
      origin: 'explorer-drop',
      isDirectory: true
    })
  })

  it('should keep text files as file refs', () => {
    expect(
      asWorkspaceTextRef({
        id: '2',
        fileName: 'a.md',
        filePath: '/tmp/proj/a.md',
        relativePath: 'a.md',
        isImage: false,
        isPdf: false,
        isText: true,
        origin: 'explorer-drop'
      })
    ).toEqual({
      relativePath: 'a.md',
      origin: 'explorer-drop'
    })
  })
})
