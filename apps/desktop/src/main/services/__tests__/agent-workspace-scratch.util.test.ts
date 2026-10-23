import * as path from 'path'
import { describe, expect, it } from 'vitest'
import {
  isScratchWorkspaceEntry,
  LEGACY_SCRATCH_WORKSPACE_DISPLAY_NAMES,
  listLegacyScratchFolderCandidates,
  resolveAppInstallRoot,
  resolveScratchWorkspaceFolderRoot,
  SCRATCH_WORKSPACE_DISPLAY_NAME
} from '../agent-workspace-scratch.util'

describe('agent-workspace-scratch.util', () => {
  it('should put the scratch folder under the user documents directory when present', () => {
    const folder = resolveScratchWorkspaceFolderRoot({
      documentsRoot: 'C:/Users/demo/Documents',
      userDataRoot: 'C:/Users/demo/AppData/BaiShou'
    })

    expect(folder).toBe(path.join('C:/Users/demo/Documents', SCRATCH_WORKSPACE_DISPLAY_NAME))
    expect(folder.endsWith(SCRATCH_WORKSPACE_DISPLAY_NAME)).toBe(true)
  })

  it('should fall back to userData when documents root is missing', () => {
    const folder = resolveScratchWorkspaceFolderRoot({
      documentsRoot: null,
      userDataRoot: 'D:/Users/demo/AppData/BaiShou'
    })

    expect(folder).toBe(path.join('D:/Users/demo/AppData/BaiShou', SCRATCH_WORKSPACE_DISPLAY_NAME))
  })

  it('should fall back to userData when documents root is blank', () => {
    const folder = resolveScratchWorkspaceFolderRoot({
      documentsRoot: '   ',
      userDataRoot: 'C:/userdata'
    })

    expect(folder).toBe(path.join('C:/userdata', SCRATCH_WORKSPACE_DISPLAY_NAME))
  })

  it('should list install-root and userData scratch folders as legacy locations', () => {
    const folders = listLegacyScratchFolderCandidates({
      installRoot: 'D:/Apps/BaiShou',
      userDataRoot: 'C:/Users/demo/AppData/BaiShou'
    })

    expect(folders).toEqual([
      path.join('D:/Apps/BaiShou', SCRATCH_WORKSPACE_DISPLAY_NAME),
      path.join('D:/Apps/BaiShou', LEGACY_SCRATCH_WORKSPACE_DISPLAY_NAMES[0]),
      path.join('C:/Users/demo/AppData/BaiShou', SCRATCH_WORKSPACE_DISPLAY_NAME),
      path.join('C:/Users/demo/AppData/BaiShou', LEGACY_SCRATCH_WORKSPACE_DISPLAY_NAMES[0])
    ])
  })

  it('resolves packaged install root from exe dirname', () => {
    const exePath = 'D:/Apps/BaiShou/BaiShou.exe'
    expect(
      resolveAppInstallRoot({
        isPackaged: true,
        exePath,
        appPath: 'D:/Apps/BaiShou/resources/app.asar'
      })
    ).toBe(path.dirname(exePath))
  })

  it('resolves unpackaged install root from appPath', () => {
    expect(
      resolveAppInstallRoot({
        isPackaged: false,
        exePath: 'D:/repo/node_modules/electron/dist/electron.exe',
        appPath: 'D:/repo/apps/desktop'
      })
    ).toBe('D:/repo/apps/desktop')
  })

  it('detects scratch entries by kind, current name, or legacy name', () => {
    expect(isScratchWorkspaceEntry({ kind: 'scratch', displayName: 'other' })).toBe(true)
    expect(
      isScratchWorkspaceEntry({ kind: 'folder', displayName: SCRATCH_WORKSPACE_DISPLAY_NAME })
    ).toBe(true)
    expect(
      isScratchWorkspaceEntry({
        kind: 'folder',
        displayName: LEGACY_SCRATCH_WORKSPACE_DISPLAY_NAMES[0]
      })
    ).toBe(true)
    expect(isScratchWorkspaceEntry({ kind: 'folder', displayName: 'Demo' })).toBe(false)
  })
})
