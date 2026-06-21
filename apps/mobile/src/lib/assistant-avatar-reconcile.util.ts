import type { AssistantManagerService, IFileSystem, IStoragePathService } from '@baishou/core-mobile'
import { DEFAULT_BUILTIN_ASSISTANT_AVATAR_PATH } from '@baishou/shared'
import { invalidateAssistantAvatarDisplayCache } from './assistant-avatar-display.util'

async function assistantAvatarFileExists(
  avatarPath: string,
  pathService: IStoragePathService,
  fileSystem: IFileSystem
): Promise<boolean> {
  if (!avatarPath.startsWith('avatars/')) return true

  const filename = avatarPath.split('/').pop() || avatarPath
  const candidateDirs = [
    await pathService.getAvatarsDirectory(),
    await pathService.getUserAvatarsDirectory()
  ]

  for (const dir of candidateDirs) {
    if (await fileSystem.exists(`${dir}/${filename}`)) {
      return true
    }
  }
  return false
}

/**
 * 存储变更后：若伙伴自定义头像文件已被系统相册等外部删除，回退为内置默认头像。
 */
export async function reconcileAssistantAvatarsAfterStorageChange(
  assistantManager: AssistantManagerService,
  pathService: IStoragePathService,
  fileSystem: IFileSystem
): Promise<number> {
  const assistants = await assistantManager.findAll()
  let fixed = 0

  for (const assistant of assistants) {
    const avatarPath = assistant.avatarPath
    if (!avatarPath?.startsWith('avatars/')) continue
    if (await assistantAvatarFileExists(avatarPath, pathService, fileSystem)) continue

    await assistantManager.update(assistant.id, {
      avatarPath: DEFAULT_BUILTIN_ASSISTANT_AVATAR_PATH
    })
    invalidateAssistantAvatarDisplayCache(avatarPath)
    invalidateAssistantAvatarDisplayCache(DEFAULT_BUILTIN_ASSISTANT_AVATAR_PATH)
    fixed += 1
  }

  return fixed
}
