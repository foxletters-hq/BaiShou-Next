import * as ImagePicker from 'expo-image-picker'
import type {
  IAttachmentManager,
  AttachmentItem,
  SessionAttachmentGroup,
  DiaryAttachmentFileItem,
  IFileSystem,
  IStoragePathService
} from '@baishou/core-mobile'
import { joinPath, basename } from '@baishou/core-mobile'
import { importUriToPath, inferImageExtension } from './mobile-uri-import'
import { toFileUri } from './android-external-fs'

/**
 * 移动端附件管理，所有 vault 读写经 IFileSystem。
 */
export class MobileAttachmentManagerService implements IAttachmentManager {
  constructor(
    private readonly pathService: IStoragePathService,
    private readonly fileSystem: IFileSystem
  ) {}

  /** 历史版本将伙伴头像写在 vault/.baishou/avatars；现统一为 attachments/avatars */
  private async legacyVaultAvatarsDirs(): Promise<string[]> {
    const dirs: string[] = []
    try {
      dirs.push(joinPath(await this.pathService.getVaultSystemDirectory('default'), 'avatars'))
    } catch {
      // ignore
    }
    try {
      const activePath = await this.pathService.getActiveVaultPath()
      if (activePath) {
        const activeDir = joinPath(activePath, '.baishou', 'avatars')
        if (!dirs.includes(activeDir)) dirs.push(activeDir)
      }
    } catch {
      // ignore
    }
    return dirs
  }

  async importAvatar(absoluteSourcePath: string, prefix = 'agent'): Promise<string> {
    const avatarsDir = await this.pathService.getAvatarsDirectory()
    const ext = inferImageExtension(absoluteSourcePath)
    const name = `${prefix}_${Date.now()}.${ext}`
    const dest = joinPath(avatarsDir, name)
    await importUriToPath(absoluteSourcePath, dest, this.fileSystem)
    return `avatars/${name}`
  }

  async resolveAvatarPath(relativePath: string): Promise<string> {
    if (!relativePath?.startsWith('avatars/')) {
      return relativePath
    }

    const filename = basename(relativePath)
    const candidateDirs = [
      await this.pathService.getAvatarsDirectory(),
      ...(await this.legacyVaultAvatarsDirs())
    ]

    for (const dir of candidateDirs) {
      const absPath = joinPath(dir, filename)
      if (await this.fileSystem.exists(absPath)) {
        return toFileUri(absPath)
      }
    }

    throw new Error(`AVATAR_FILE_NOT_FOUND: ${relativePath}`)
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
    const attDir = await this.pathService.getAttachmentsBaseDirectory()
    if (!(await this.fileSystem.exists(attDir))) return []

    const sessionIds = await this.fileSystem.readdir(attDir)
    const out: SessionAttachmentGroup[] = []

    for (const sessionId of sessionIds) {
      const sessionDir = joinPath(attDir, sessionId)
      const dirStat = await this.fileSystem.stat(sessionDir).catch(() => null)
      if (!dirStat?.isDirectory) continue
      const files = await this.fileSystem.readdir(sessionDir)
      let total = 0
      const items = []
      for (const name of files) {
        const fp = joinPath(sessionDir, name)
        const st = await this.fileSystem.stat(fp).catch(() => null)
        if (!st?.isFile) continue
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
    const attDir = await this.pathService.getAttachmentsBaseDirectory()
    const fp = joinPath(attDir, sessionId, fileName)
    await this.fileSystem.unlink(fp)
  }

  async deleteBatch(ids: string[]): Promise<void> {
    const attDir = await this.pathService.getAttachmentsBaseDirectory()
    for (const id of ids) {
      const fp = joinPath(attDir, id)
      await this.fileSystem.rm(fp, { recursive: true, force: true })
    }
  }

  async listDiaryAttachments(): Promise<DiaryAttachmentFileItem[]> {
    const journalsDir = await this.pathService.getJournalsBaseDirectory()
    if (!(await this.fileSystem.exists(journalsDir))) return []
    return this.walkDiaryAttachments(journalsDir, journalsDir)
  }

  private async walkDiaryAttachments(
    root: string,
    dir: string,
    acc: DiaryAttachmentFileItem[] = []
  ): Promise<DiaryAttachmentFileItem[]> {
    const entries = await this.fileSystem.readdir(dir)
    for (const name of entries) {
      const full = joinPath(dir, name)
      const st = await this.fileSystem.stat(full).catch(() => null)
      if (st?.isDirectory) {
        await this.walkDiaryAttachments(root, full, acc)
      } else if (st?.isFile && name.match(/\.(png|jpe?g|gif|webp|pdf)$/i)) {
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
    await this.fileSystem.unlink(filePath)
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
