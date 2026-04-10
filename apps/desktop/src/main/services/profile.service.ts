import { app, dialog } from 'electron';
import { AttachmentManagerService } from '@baishou/core';
import { DesktopStoragePathService } from './path.service';

/**
 * 后端 User Profile 管理服务封装
 * 处理前端沙箱无法接触的物理文件 IO
 */
export class ProfileService {
  private pathService = new DesktopStoragePathService();
  private attachmentManager = new AttachmentManagerService(this.pathService);

  /**
   * 唤起系统文件选择框，让用户选择新头像
   * 然后调用中央附件管理器导入到 Vault 中，并转译为绝对路径喂回给前端。
   *
   * @returns 拷贝并解析后的新图片绝对路径。如果用户取消选择，则返回 null。
   */
  async pickAndSaveAvatar(): Promise<string | null> {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: '选择新头像',
      buttonLabel: '确定',
      properties: ['openFile'],
      filters: [
        { name: 'Images', extensions: ['jpg', 'png', 'jpeg', 'webp', 'gif'] }
      ]
    });

    if (canceled || filePaths.length === 0) {
      return null;
    }

    const sourcePath = filePaths[0];
    
    // Delegate to central core logic
    const relativePath = await this.attachmentManager.importAvatar(sourcePath, 'user_avatar');
    
    // Resolve back to absolute since the electron dialog boundary and UI expects physical previews instantly
    return await this.attachmentManager.resolveAvatarPath(relativePath);
  }

  async processProfileInput(input: any) {
    if (input.avatarPath && typeof input.avatarPath === 'string' && input.avatarPath.trim() !== '') {
      if (!input.avatarPath.startsWith('avatars/')) {
        input.avatarPath = await this.attachmentManager.importAvatar(input.avatarPath, 'user_avatar');
      }
    }
  }

  async mapProfileOutput(profile: any) {
    if (!profile) return profile;
    if (profile.avatarPath && profile.avatarPath.startsWith('avatars/')) {
      profile.avatarPath = await this.attachmentManager.resolveAvatarPath(profile.avatarPath);
    }
    return profile;
  }
}

export const profileService = new ProfileService();
