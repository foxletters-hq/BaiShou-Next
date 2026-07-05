import { describe, expect, it } from 'vitest'
import {
  isFilesystemRootPath,
  isValidWorkspaceRoot,
  resolveLegacyMigrationTargetRoot,
  sanitizePersistedWorkspaceRoot
} from '../workspace-root.util'

describe('workspace-root.util', () => {
  it('detects windows drive roots', () => {
    expect(isFilesystemRootPath('D:\\')).toBe(true)
    expect(isFilesystemRootPath('D:')).toBe(true)
    expect(isFilesystemRootPath('C:/')).toBe(true)
  })

  it('rejects drive roots as workspace roots', () => {
    expect(isValidWorkspaceRoot('D:\\')).toBe(false)
    expect(isValidWorkspaceRoot('C:\\Program Files')).toBe(false)
  })

  it('accepts normal workspace roots', () => {
    expect(isValidWorkspaceRoot('D:\\BaiShou_Root')).toBe(true)
    expect(isValidWorkspaceRoot('/home/user/BaiShou_Root')).toBe(true)
  })

  it('maps drive roots to BaiShou_Root child directory', () => {
    expect(resolveLegacyMigrationTargetRoot('D:\\')).toBe('D:\\BaiShou_Root')
    expect(resolveLegacyMigrationTargetRoot('D:\\BaiShou')).toBe('D:\\BaiShou')
  })

  it('sanitizes persisted workspace roots', () => {
    expect(sanitizePersistedWorkspaceRoot('D:\\')).toBe('D:\\BaiShou_Root')
    expect(sanitizePersistedWorkspaceRoot('D:\\BaiShou_Root')).toBe('D:\\BaiShou_Root')
  })
})
