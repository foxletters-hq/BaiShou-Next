import { dialog } from 'electron'
import { DesktopAttachmentManagerService } from './desktop-attachment-manager.service'
import { USER_DEFAULT_AVATAR_SENTINEL } from '@baishou/shared'
import { DesktopStoragePathService } from './path.service'

/**
 * 后端 User Profile 管理服务封装
 * 处理前端沙箱无法接触的物理文件 IO
 */
export class ProfileService {
  private pathService = new DesktopStoragePathService()
  private attachmentManager = new DesktopAttachmentManagerService(this.pathService)

  /**
   * 唤起系统文件选择框，让用户选择新头像
   * 然后导入到全应用共用的用户头像目录（不随工作空间切换），并转译为绝对路径喂回给前端。
   *
   * @returns 拷贝并解析后的新图片绝对路径。如果用户取消选择，则返回 null。
   */
  async pickAndSaveAvatar(): Promise<string | null> {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: '选择新头像',
      buttonLabel: '确定',
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['jpg', 'png', 'jpeg', 'webp', 'gif'] }]
    })

    if (canceled || filePaths.length === 0) {
      return null
    }

    const sourcePath = filePaths[0]

    // Delegate to central core logic
    const relativePath = await this.attachmentManager.importAvatar(sourcePath, 'user_avatar')

    // Resolve back to absolute since the electron dialog boundary and UI expects physical previews instantly
    return await this.attachmentManager.resolveAvatarPath(relativePath)
  }

  /**
   * 唤起系统文件选择框，让用户选择聊天背景图
   * 复用头像导入的压缩与路径解析逻辑，但存储到 backgrounds/ 子目录。
   *
   * @returns 新背景图的 local:// 绝对路径。如果用户取消选择，则返回 null。
   */
  async pickAndSaveBackground(): Promise<string | null> {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: '选择聊天背景图',
      buttonLabel: '确定',
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['jpg', 'png', 'jpeg', 'webp'] }]
    })

    if (canceled || filePaths.length === 0) {
      return null
    }

    const sourcePath = filePaths[0]
    const relativePath = await this.attachmentManager.importBackground(sourcePath)
    return await this.attachmentManager.resolveBackgroundPath(relativePath)
  }

  async processProfileInput(input: any) {
    if (
      input.avatarPath &&
      typeof input.avatarPath === 'string' &&
      input.avatarPath.trim() !== ''
    ) {
      if (!input.avatarPath.startsWith('avatars/')) {
        input.avatarPath = await this.attachmentManager.importAvatar(
          input.avatarPath,
          'user_avatar'
        )
      }
    }

    if (
      input.chatBackgroundPath &&
      typeof input.chatBackgroundPath === 'string' &&
      input.chatBackgroundPath.trim() !== ''
    ) {
      if (!input.chatBackgroundPath.startsWith('backgrounds/')) {
        input.chatBackgroundPath = await this.attachmentManager.importBackground(
          input.chatBackgroundPath
        )
      }
    }
  }

  async mapProfileOutput(profile: any) {
    if (!profile) return profile
    if (profile.avatarPath && profile.avatarPath.startsWith('avatars/')) {
      try {
        profile.avatarPath = await this.attachmentManager.resolveAvatarPath(profile.avatarPath)
      } catch (e: any) {
        if (e instanceof Error && e.message === 'AVATAR_FILE_NOT_FOUND') {
          profile.avatarPath = USER_DEFAULT_AVATAR_SENTINEL
          profile.avatarFileMissing = true
        }
      }
    }
    if (profile.chatBackgroundPath && profile.chatBackgroundPath.startsWith('backgrounds/')) {
      try {
        profile.chatBackgroundPath = await this.attachmentManager.resolveBackgroundPath(
          profile.chatBackgroundPath
        )
      } catch {
        profile.chatBackgroundPath = null
      }
    }
    return profile
  }
}

export const profileService = new ProfileService()
