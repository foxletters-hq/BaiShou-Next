import type { IFileSystem, IStoragePathService } from '@baishou/core-mobile'
import {
  USER_DEFAULT_AVATAR_SENTINEL,
  getUserProfileFromSettings,
  isCustomUserAvatar,
  saveUserProfileToSettings,
  type UserProfileSettingsStore
} from '@baishou/shared'

async function userAvatarFileExists(
  avatarPath: string,
  pathService: IStoragePathService,
  fileSystem: IFileSystem
): Promise<boolean> {
  if (!avatarPath.startsWith('avatars/')) return true

  const filename = avatarPath.split('/').pop() || avatarPath
  const candidateDirs = [
    await pathService.getUserAvatarsDirectory(),
    await pathService.getAvatarsDirectory()
  ]

  for (const dir of candidateDirs) {
    if (await fileSystem.exists(`${dir}/${filename}`)) {
      return true
    }
  }
  return false
}

/**
 * 存储恢复/增量同步后：若 profile 指向的自定义头像文件不存在，回退为默认占位。
 */
export async function reconcileUserAvatarProfileAfterStorageChange(
  settingsManager: UserProfileSettingsStore,
  pathService: IStoragePathService,
  fileSystem: IFileSystem
): Promise<boolean> {
  const profile = await getUserProfileFromSettings(settingsManager)
  const avatarPath = profile.avatarPath
  if (!isCustomUserAvatar(avatarPath) || !avatarPath?.startsWith('avatars/')) {
    return false
  }

  if (await userAvatarFileExists(avatarPath, pathService, fileSystem)) {
    return false
  }

  const next: typeof profile = {
    ...profile,
    avatarPath: USER_DEFAULT_AVATAR_SENTINEL
  }
  await saveUserProfileToSettings(settingsManager, next)
  return true
}
