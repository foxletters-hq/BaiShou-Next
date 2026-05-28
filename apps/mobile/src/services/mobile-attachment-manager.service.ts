import * as FileSystem from 'expo-file-system'
import * as ImagePicker from 'expo-image-picker'
import type { IAttachmentManager, AttachmentItem, SessionAttachmentGroup, DiaryAttachmentFileItem } from '@baishou/core-mobile'
import type { IStoragePathService } from '@baishou/core-mobile'
import { joinPath } from '@baishou/core-mobile'

/**
 * 移动端附件管理（expo-file-system），满足 AssistantManager 与设置页扫描需求。
 */
export class MobileAttachmentManagerService implements IAttachmentManager {
  constructor(private readonly pathService: IStoragePathService) {}

  private async vaultSystemDir(): Promise<string> {
    return this.pathService.getVaultSystemDirectory('default')
  }

  async importAvatar(absoluteSourcePath: string, prefix = 'agent'): Promise<string> {
    const sysDir = await this.vaultSystemDir()
    const avatarsDir = joinPath(sysDir, 'avatars')
    await FileSystem.makeDirectoryAsync(avatarsDir, { intermediates: true })
    const ext = absoluteSourcePath.includes('.') ? absoluteSourcePath.split('.').pop() : 'jpg'
    const name = `${prefix}_${Date.now()}.${ext}`
    const dest = joinPath(avatarsDir, name)
    await FileSystem.copyAsync({ from: absoluteSourcePath, to: dest })
    return `avatars/${name}`
  }

  async resolveAvatarPath(relativePath: string): Promise<string> {
    const sysDir = await this.vaultSystemDir()
    return joinPath(sysDir, relativePath)
  }

  async listOrphans(activeSessionIds: Set<string>): Promise<AttachmentItem[]> {
    const groups = await this.listSessionGroups(activeSessionIds)
    return groups
      .filter((g) => g.isOrphan)
      .map((g) => ({
        id: g.sessionId,
        name: g.sessionTitle || g.sessionId,
        sizeMB: g.totalSizeMB,
        isOrphan: true,
        fileCount: g.fileCount,
        date: new Date().toISOString()
      }))
  }

  async listSessionGroups(activeSessionIds: Set<string>): Promise<SessionAttachmentGroup[]> {
    const sysDir = await this.vaultSystemDir()
    const attDir = joinPath(sysDir, 'attachments')
    const info = await FileSystem.getInfoAsync(attDir)
    if (!info.exists) return []

    const sessionIds = await FileSystem.readDirectoryAsync(attDir)
    const out: SessionAttachmentGroup[] = []

    for (const sessionId of sessionIds) {
      const sessionDir = joinPath(attDir, sessionId)
      const dirInfo = await FileSystem.getInfoAsync(sessionDir)
      if (!dirInfo.isDirectory) continue
      const files = await FileSystem.readDirectoryAsync(sessionDir)
      let total = 0
      const items = []
      for (const name of files) {
        const fp = joinPath(sessionDir, name)
        const st = await FileSystem.getInfoAsync(fp)
        if (!st.exists || st.isDirectory) continue
        const sizeMB = (st.size ?? 0) / (1024 * 1024)
        total += sizeMB
        items.push({
          name,
          path: fp,
          sizeMB,
          birthtime: new Date().toISOString()
        })
      }
      out.push({
        sessionId,
        isOrphan: !activeSessionIds.has(sessionId),
        totalSizeMB: total,
        fileCount: items.length,
        files: items
      })
    }
    return out
  }

  async deleteFile(sessionId: string, fileName: string): Promise<void> {
    const sysDir = await this.vaultSystemDir()
    const fp = joinPath(sysDir, 'attachments', sessionId, fileName)
    await FileSystem.deleteAsync(fp, { idempotent: true })
  }

  async deleteBatch(ids: string[]): Promise<void> {
    const sysDir = await this.vaultSystemDir()
    for (const id of ids) {
      const fp = joinPath(sysDir, 'attachments', id)
      await FileSystem.deleteAsync(fp, { idempotent: true })
    }
  }

  async listDiaryAttachments(): Promise<DiaryAttachmentFileItem[]> {
    const journalsDir = await this.pathService.getJournalsBaseDirectory()
    const info = await FileSystem.getInfoAsync(journalsDir)
    if (!info.exists) return []
    return this.walkDiaryAttachments(journalsDir, journalsDir)
  }

  private async walkDiaryAttachments(
    root: string,
    dir: string,
    acc: DiaryAttachmentFileItem[] = []
  ): Promise<DiaryAttachmentFileItem[]> {
    const entries = await FileSystem.readDirectoryAsync(dir)
    for (const name of entries) {
      const full = joinPath(dir, name)
      const st = await FileSystem.getInfoAsync(full)
      if (st.isDirectory) {
        await this.walkDiaryAttachments(root, full, acc)
      } else if (name.match(/\.(png|jpe?g|gif|webp|pdf)$/i)) {
        const rel = full.replace(root + '/', '')
        acc.push({
          name,
          path: full,
          relativePath: rel,
          sizeMB: (st.size ?? 0) / (1024 * 1024),
          birthtime: new Date().toISOString(),
          yearMonth: rel.slice(0, 7),
          isOrphan: false
        })
      }
    }
    return acc
  }

  async deleteDiaryAttachment(filePath: string): Promise<void> {
    await FileSystem.deleteAsync(filePath, { idempotent: true })
  }

  /** 从相册选取头像并导入 */
  static async pickAndImportAvatar(
    manager: MobileAttachmentManagerService
  ): Promise<string | null> {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) return null
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.9
    })
    if (result.canceled || !result.assets[0]?.uri) return null
    return manager.importAvatar(result.assets[0].uri, 'user')
  }
}
