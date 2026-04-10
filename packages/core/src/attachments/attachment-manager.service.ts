import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { IStoragePathService } from '../vault/storage-path.types';
import { IAttachmentManager, AttachmentItem } from './attachment-manager.types';

export class AttachmentManagerService implements IAttachmentManager {
  constructor(private readonly pathProvider: IStoragePathService) {}

  public async importAvatar(absoluteSourcePath: string, prefix: string = 'avatar'): Promise<string> {
    if (!absoluteSourcePath || absoluteSourcePath.trim() === '') {
      return absoluteSourcePath;
    }
    // If it's already a relative path representing vault avatar storage, ignore
    if (absoluteSourcePath.startsWith('avatars/')) {
      return absoluteSourcePath;
    }

    if (absoluteSourcePath.startsWith('local://')) {
      // Check if it's already an avatar sitting in our vault
      const match = absoluteSourcePath.match(/avatars[/\\]([^/\\]+)$/);
      if (match) {
        return `avatars/${match[1]}`;
      }
      try {
        const fileUrlNode = absoluteSourcePath.replace(/^local:/i, 'file:');
        absoluteSourcePath = fileURLToPath(fileUrlNode);
      } catch (e) {
        console.warn('[AttachmentManager] fallback parsing local URI');
        absoluteSourcePath = decodeURIComponent(absoluteSourcePath.slice('local://'.length));
      }
    }
    
    try {
      const avatarsDir = await this.pathProvider.getAvatarsDirectory();
      
      // Handle Base64 Data URL
      if (absoluteSourcePath.startsWith('data:image/')) {
        const matches = absoluteSourcePath.match(/^data:image\/([^;]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const extension = matches[1] === 'jpeg' ? '.jpg' : `.${matches[1].replace(/[^a-zA-Z0-9]/g, '')}`;
          const newFileName = `${prefix}_${Date.now()}${extension}`;
          const newPath = path.join(avatarsDir, newFileName);
          
          await fs.writeFile(newPath, Buffer.from(matches[2], 'base64'));
          return `avatars/${newFileName}`;
        }
      }

      // Ignore invalid paths or network URIs during standard file import
      if (!existsSync(absoluteSourcePath)) {
        return absoluteSourcePath;
      }

      const ext = path.extname(absoluteSourcePath).toLowerCase();
      const newFileName = `${prefix}_${Date.now()}${ext}`;
      const newPath = path.join(avatarsDir, newFileName);
      
      await fs.copyFile(absoluteSourcePath, newPath);
      
      // Store relative path
      return `avatars/${newFileName}`;
    } catch (e) {
      console.error('[AttachmentManager] Failed to copy/decode avatar:', e);
      return absoluteSourcePath;
    }
  }

  public async resolveAvatarPath(relativePath: string): Promise<string> {
    if (relativePath && relativePath.startsWith('avatars/')) {
      try {
        const avatarsDir = await this.pathProvider.getAvatarsDirectory();
        const filename = relativePath.split(/[/\\]/).pop() || relativePath;
        const absPath = path.join(avatarsDir, filename);
        // Map absolute path to our custom local file protocol to bypass Chrome webSecurity restrictions
        // We use pathToFileURL because it strictly covers Windows triple slash file:///C:/ escaping correctly.
        return pathToFileURL(absPath).toString().replace(/^file:/i, 'local:');
      } catch (e) {
        console.error('[AttachmentManager] Failed to resolve avatar path:', e);
      }
    }
    return relativePath;
  }

  private async getDirectorySize(dirPath: string): Promise<{ size: number, count: number }> {
    let size = 0;
    let count = 0;
    try {
      const files = await fs.readdir(dirPath, { withFileTypes: true });
      for (const file of files) {
        const fullPath = path.join(dirPath, file.name);
        if (file.isDirectory()) {
          const sub = await this.getDirectorySize(fullPath);
          size += sub.size;
          count += sub.count;
        } else {
          const stat = await fs.stat(fullPath);
          size += stat.size;
          count += 1;
        }
      }
    } catch {
      // Ignored
    }
    return { size, count };
  }

  public async listOrphans(activeSessionIds: Set<string>): Promise<AttachmentItem[]> {
    const items: AttachmentItem[] = [];
    let attachBase: string;
    try {
      attachBase = await this.pathProvider.getAttachmentsBaseDirectory();
      if (!existsSync(attachBase)) {
        return [];
      }
    } catch {
      return [];
    }

    try {
      const folders = await fs.readdir(attachBase, { withFileTypes: true });
      
      for (const folder of folders) {
        if (!folder.isDirectory() || folder.name === 'avatars') {
          continue;
        }

        const sessionId = folder.name;
        const fullDir = path.join(attachBase, sessionId);
        const { size, count } = await this.getDirectorySize(fullDir);
        
        if (count === 0 && size === 0) {
          try { await fs.rm(fullDir, { recursive: true, force: true }); } catch {}
          continue;
        }
        
        const stat = await fs.stat(fullDir);
        
        items.push({
          id: sessionId,
          name: sessionId,
          sizeMB: size / (1024 * 1024),
          isOrphan: !activeSessionIds.has(sessionId),
          fileCount: count,
          date: stat.mtime.toISOString(),
        });
      }
    } catch (e) {
      console.error('[AttachmentManager] Error listing attachments:', e);
    }
    
    return items;
  }

  public async deleteBatch(ids: string[]): Promise<void> {
    const attachBase = await this.pathProvider.getAttachmentsBaseDirectory();
    for (const id of ids) {
      const safeId = id.replace(/[/\\]/g, '');
      if (safeId === 'avatars' || safeId.trim() === '') continue;
      
      const targetDir = path.join(attachBase, safeId);
      try {
        if (existsSync(targetDir)) {
          await fs.rm(targetDir, { recursive: true, force: true });
        }
      } catch (e) {
        console.error(`[AttachmentManager] Failed to delete attachment directory ${targetDir}:`, e);
      }
    }
  }
}
