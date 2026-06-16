import { describe, it, expect } from 'vitest'
import { MigrationTargetStoragePathService } from '../migration-target-path.service'

describe('MigrationTargetStoragePathService', () => {
  it('resolves avatar directories under the migration target workspace', async () => {
    const pathService = new MigrationTargetStoragePathService('/data/BaiShou_Root', 'Personal')
    await expect(pathService.getRootDirectory()).resolves.toBe('/data/BaiShou_Root')
    await expect(pathService.getAvatarsDirectory()).resolves.toBe(
      '/data/BaiShou_Root/Personal/Attachments/avatars'
    )
    await expect(pathService.getAssistantsBaseDirectory()).resolves.toBe(
      '/data/BaiShou_Root/Personal/Assistants'
    )
  })

  it('supports file URI workspace roots on mobile', async () => {
    const pathService = new MigrationTargetStoragePathService(
      'file:///storage/emulated/0/BaiShou_Root',
      'Personal'
    )
    await expect(pathService.getSessionsBaseDirectory()).resolves.toBe(
      'file://storage/emulated/0/BaiShou_Root/Personal/Sessions'
    )
  })
})
