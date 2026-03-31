import { app, dialog } from 'electron';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

/**
 * 后端 User Profile 管理服务封装
 * 处理前端沙箱无法接触的物理文件 IO
 */
export class ProfileService {
  /**
   * 唤起系统文件选择框，让用户选择新头像
   * 然后拷贝到安全的持久化应用数据目录，返回新路径供前端更新配置使用
   *
   * @returns 拷贝后的新图片绝对路径。如果用户取消选择，则返回 null。
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
    const extension = path.extname(sourcePath).toLowerCase();
    
    // 生成安全的目标存储路径
    const userDataPath = app.getPath('userData');
    const avatarsDir = path.join(userDataPath, 'avatars');

    // 目录存在性校验
    if (!existsSync(avatarsDir)) {
      await fs.mkdir(avatarsDir, { recursive: true });
    }

    const newFileName = `avatar_${Date.now()}${extension}`;
    const destinationPath = path.join(avatarsDir, newFileName);

    // 物理复制
    await fs.copyFile(sourcePath, destinationPath);
    
    return destinationPath;
  }
}

export const profileService = new ProfileService();
