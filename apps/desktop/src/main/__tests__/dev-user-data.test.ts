import { describe, it, expect } from 'vitest'
import { join } from 'path'
import {
  DEV_USER_DATA_DIR_NAME,
  resolveDevUserDataPath,
  isStorageRootWithinUserData
} from '../dev-user-data'

describe('dev-user-data', () => {
  it('resolves dev userData under appData with a distinct folder name', () => {
    // 源函数使用平台默认 path.join，断言用同样的 join 构造以保持跨平台
    const appData = join('Users', 'Anson', 'AppData', 'Roaming')
    expect(resolveDevUserDataPath(appData)).toBe(join(appData, DEV_USER_DATA_DIR_NAME))
    expect(DEV_USER_DATA_DIR_NAME).toBe('白守-dev')
  })

  it('detects storage roots inside or outside userData', () => {
    // 用宿主平台路径分隔符验证包含关系逻辑（跨平台）
    const userData = join('/data', '白守-dev')
    expect(isStorageRootWithinUserData(join(userData, 'Vaults'), userData)).toBe(true)
    expect(isStorageRootWithinUserData(join('/data', 'Desktop', 'bs-v3'), userData)).toBe(false)
  })
})
