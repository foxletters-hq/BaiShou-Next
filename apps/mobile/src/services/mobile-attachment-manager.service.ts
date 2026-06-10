import * as ImagePicker from 'expo-image-picker'
import { extractReferencedFileNames } from '@baishou/shared'
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
      if (sessionId === 'avatars') continue

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

      if (items.length === 0) {
        await this.fileSystem.rm(sessionDir, { recursive: true, force: true }).catch(() => {})
        continue
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

    const sessionDir = joinPath(attDir, sessionId)
    if (await this.fileSystem.exists(sessionDir)) {
      const remaining = await this.fileSystem.readdir(sessionDir)
      if (remaining.length === 0) {
        await this.fileSystem.rm(sessionDir, { recursive: true, force: true }).catch(() => {})
      }
    }
  }

  async deleteBatch(ids: string[]): Promise<void> {
    const attDir = await this.pathService.getAttachmentsBaseDirectory()
    for (const id of ids) {
      const safeId = id.replace(/[/\\]/g, '')
      if (safeId === 'avatars' || safeId.trim() === '') continue
      const fp = joinPath(attDir, safeId)
      await this.fileSystem.rm(fp, { recursive: true, force: true })
    }
  }

  async listDiaryAttachments(): Promise<DiaryAttachmentFileItem[]> {
    const journalsDir = await this.pathService.getJournalsBaseDirectory()
    if (!(await this.fileSystem.exists(journalsDir))) return []

    const list: DiaryAttachmentFileItem[] = []
    const years = await this.fileSystem.readdir(journalsDir)

    for (const year of years) {
      if (!/^\d{4}$/.test(year)) continue
      const yearPath = joinPath(journalsDir, year)
      const yearStat = await this.fileSystem.stat(yearPath).catch(() => null)
      if (!yearStat?.isDirectory) continue

      const months = await this.fileSystem.readdir(yearPath)
      for (const month of months) {
        if (!/^\d{2}$/.test(month)) continue
        const monthPath = joinPath(yearPath, month)
        const monthStat = await this.fileSystem.stat(monthPath).catch(() => null)
        if (!monthStat?.isDirectory) continue

        const attachDir = joinPath(monthPath, 'attachment')
        if (!(await this.fileSystem.exists(attachDir))) continue

        const attachEntries = await this.fileSystem.readdir(attachDir)
        const monthFiles: string[] = []
        for (const name of attachEntries) {
          const fp = joinPath(attachDir, name)
          const st = await this.fileSystem.stat(fp).catch(() => null)
          if (st?.isFile) monthFiles.push(name)
        }
        if (monthFiles.length === 0) continue

        const referencedNames = new Set<string>()
        const diaryPlainTexts: string[] = []
        const siblingFiles = await this.fileSystem.readdir(monthPath)
        const diaryFiles = siblingFiles.filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))

        await Promise.all(
          diaryFiles.map(async (df) => {
            try {
              const content = await this.fileSystem.readFile(joinPath(monthPath, df))
              diaryPlainTexts.push(content)
              for (const ref of extractReferencedFileNames(content)) {
                referencedNames.add(ref)
              }
            } catch {
              // ignore
            }
          })
        )

        for (const name of monthFiles) {
          const fullFilePath = joinPath(attachDir, name)
          const st = await this.fileSystem.stat(fullFilePath).catch(() => null)
          if (!st?.isFile) continue

          const relativePath = fullFilePath
            .slice(journalsDir.length)
            .replace(/^[/\\]/, '')
            .replace(/\\/g, '/')
          const lowerFileName = name.toLowerCase()
          let isOrphan = !referencedNames.has(lowerFileName)
          if (isOrphan && diaryPlainTexts.length > 0) {
            isOrphan = !diaryPlainTexts.some((content) =>
              content.toLowerCase().includes(lowerFileName)
            )
          }

          list.push({
            name,
            path: fullFilePath,
            relativePath,
            sizeMB: (st.size ?? 0) / (1024 * 1024),
            birthtime: new Date().toISOString(),
            yearMonth: `${year}-${month}`,
            isOrphan
          })
        }
      }
    }

    return list
  }

  async deleteDiaryAttachment(filePath: string): Promise<void> {
    try {
      if (await this.fileSystem.exists(filePath)) {
        await this.fileSystem.unlink(filePath)
      }

      let currentDir = joinPath(filePath, '..')
      const journalsDir = await this.pathService.getJournalsBaseDirectory()

      while (currentDir !== journalsDir && currentDir.startsWith(journalsDir)) {
        if (await this.fileSystem.exists(currentDir)) {
          const files = await this.fileSystem.readdir(currentDir)
          if (files.length === 0) {
            await this.fileSystem.rm(currentDir, { recursive: true, force: true })
            currentDir = joinPath(currentDir, '..')
          } else {
            break
          }
        } else {
          break
        }
      }
    } catch (e) {
      console.error(`[MobileAttachmentManager] Failed to delete diary attachment ${filePath}:`, e)
      throw e
    }
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
