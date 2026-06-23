import { describe, it, expect } from 'vitest'
import { DEV_USER_DATA_DIR_NAME, resolveDevUserDataPath, isStorageRootWithinUserData } from '../dev-user-data'

describe('dev-user-data', () => {
  it('resolves dev userData under appData with a distinct folder name', () => {
    const appData = 'C:\\Users\\Anson\\AppData\\Roaming'
    expect(resolveDevUserDataPath(appData)).toBe(`${appData}\\${DEV_USER_DATA_DIR_NAME}`)
    expect(DEV_USER_DATA_DIR_NAME).toBe('白守-dev')
  })

  it('detects storage roots inside or outside userData', () => {
    const userData = 'C:\\Users\\Anson\\AppData\\Roaming\\白守-dev'
    expect(isStorageRootWithinUserData(`${userData}\\Vaults`, userData)).toBe(true)
    expect(isStorageRootWithinUserData('C:\\Users\\Anson\\Desktop\\bs-v3', userData)).toBe(false)
  })
})
