import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { IStoragePathService } from '../vault/storage-path.types'
import {
  IAttachmentManager,
  AttachmentItem,
  SessionAttachmentGroup,
  AttachmentFileItem,
  DiaryAttachmentFileItem
} from './attachment-manager.types'

function safeDecodeURIComponent(str: string): string {
  try {
    return decodeURIComponent(str)
  } catch {
    return str
  }
}

export class AttachmentManagerService implements IAttachmentManager {
  constructor(private readonly pathProvider: IStoragePathService) {}

  public async importAvatar(
    absoluteSourcePath: string,
    prefix: string = 'avatar'
  ): Promise<string> {
    if (!absoluteSourcePath || absoluteSourcePath.trim() === '') {
      return absoluteSourcePath
    }
    // If it's already a relative path representing vault avatar storage, ignore
    if (absoluteSourcePath.startsWith('avatars/')) {
      return absoluteSourcePath
    }

    if (absoluteSourcePath.startsWith('local://')) {
      // Check if it's already an avatar sitting in our vault
      const match = absoluteSourcePath.match(/avatars[/\\]([^/\\]+)$/)
      if (match) {
        return `avatars/${match[1]}`
      }
      try {
        const fileUrlNode = absoluteSourcePath.replace(/^local:/i, 'file:')
        absoluteSourcePath = fileURLToPath(fileUrlNode)
      } catch (e) {
        console.warn('[AttachmentManager] fallback parsing local URI')
        absoluteSourcePath = decodeURIComponent(absoluteSourcePath.slice('local://'.length))
      }
    }

    try {
      const avatarsDir = await this.pathProvider.getAvatarsDirectory()

      // Handle Base64 Data URL
      if (absoluteSourcePath.startsWith('data:image/')) {
        const matches = absoluteSourcePath.match(/^data:image\/([^;]+);base64,(.+)$/)
        if (matches && matches.length === 3) {
          const extension =
            matches[1] === 'jpeg' ? '.jpg' : `.${matches[1]!.replace(/[^a-zA-Z0-9]/g, '')}`
          const newFileName = `${prefix}_${Date.now()}${extension}`
          const newPath = path.join(avatarsDir, newFileName)

          await fs.writeFile(newPath, Buffer.from(matches[2]!, 'base64'))
          return `avatars/${newFileName}`
        }
      }

      // Ignore invalid paths or network URIs during standard file import
      if (!existsSync(absoluteSourcePath)) {
        console.warn(`[AttachmentManager] Source file not found: ${absoluteSourcePath}`)
        return ''
      }

      const ext = path.extname(absoluteSourcePath).toLowerCase()
      const newFileName = `${prefix}_${Date.now()}${ext}`
      const newPath = path.join(avatarsDir, newFileName)

      await fs.copyFile(absoluteSourcePath, newPath)

      // Store relative path
      return `avatars/${newFileName}`
    } catch (e) {
      console.error('[AttachmentManager] Failed to copy/decode avatar:', e)
      return absoluteSourcePath
    }
  }

  public async resolveAvatarPath(relativePath: string): Promise<string> {
    if (relativePath && relativePath.startsWith('avatars/')) {
      try {
        const avatarsDir = await this.pathProvider.getAvatarsDirectory()
        const filename = relativePath.split(/[/\\]/).pop() || relativePath
        const absPath = path.join(avatarsDir, filename)

        // Verify file exists before returning URL
        if (!existsSync(absPath)) {
          console.warn(`[AttachmentManager] Avatar file not found: ${absPath}`)
          throw new Error('AVATAR_FILE_NOT_FOUND')
        }

        // Map absolute path to our custom local file protocol to bypass Chrome webSecurity restrictions
        // We use pathToFileURL because it strictly covers Windows triple slash file:///C:/ escaping correctly.
        return pathToFileURL(absPath)
          .toString()
          .replace(/^file:/i, 'local:')
      } catch (e) {
        if (e instanceof Error && e.message === 'AVATAR_FILE_NOT_FOUND') {
          throw e
        }
        console.error('[AttachmentManager] Failed to resolve avatar path:', e)
      }
    }
    return relativePath
  }

  private async getDirectorySize(dirPath: string): Promise<{ size: number; count: number }> {
    let size = 0
    let count = 0
    try {
      const files = await fs.readdir(dirPath, { withFileTypes: true })
      for (const file of files) {
        const fullPath = path.join(dirPath, file.name)
        if (file.isDirectory()) {
          const sub = await this.getDirectorySize(fullPath)
          size += sub.size
          count += sub.count
        } else {
          const stat = await fs.stat(fullPath)
          size += stat.size
          count += 1
        }
      }
    } catch {
      // Ignored
    }
    return { size, count }
  }

  public async listOrphans(activeSessionIds: Set<string>): Promise<AttachmentItem[]> {
    const items: AttachmentItem[] = []
    let attachBase: string
    try {
      attachBase = await this.pathProvider.getAttachmentsBaseDirectory()
      if (!existsSync(attachBase)) {
        return []
      }
    } catch {
      return []
    }

    try {
      const folders = await fs.readdir(attachBase, { withFileTypes: true })

      for (const folder of folders) {
        if (!folder.isDirectory() || folder.name === 'avatars') {
          continue
        }

        const sessionId = folder.name
        const fullDir = path.join(attachBase, sessionId)
        const { size, count } = await this.getDirectorySize(fullDir)

        if (count === 0 && size === 0) {
          try {
            await fs.rm(fullDir, { recursive: true, force: true })
          } catch {}
          continue
        }

        const stat = await fs.stat(fullDir)

        items.push({
          id: sessionId,
          name: sessionId,
          sizeMB: size / (1024 * 1024),
          isOrphan: !activeSessionIds.has(sessionId),
          fileCount: count,
          date: stat.mtime.toISOString()
        })
      }
    } catch (e) {
      console.error('[AttachmentManager] Error listing attachments:', e)
    }

    return items
  }

  public async deleteBatch(ids: string[]): Promise<void> {
    const attachBase = await this.pathProvider.getAttachmentsBaseDirectory()
    for (const id of ids) {
      const safeId = id.replace(/[/\\]/g, '')
      if (safeId === 'avatars' || safeId.trim() === '') continue

      const targetDir = path.join(attachBase, safeId)
      try {
        if (existsSync(targetDir)) {
          await fs.rm(targetDir, { recursive: true, force: true })
        }
      } catch (e) {
        console.error(`[AttachmentManager] Failed to delete attachment directory ${targetDir}:`, e)
      }
    }
  }

  /**
   * 递归获取目录下所有文件的详细信息
   */
  private async getDirectoryFiles(dirPath: string): Promise<AttachmentFileItem[]> {
    const fileItems: AttachmentFileItem[] = []
    try {
      const files = await fs.readdir(dirPath, { withFileTypes: true })
      for (const file of files) {
        const fullPath = path.join(dirPath, file.name)
        if (file.isDirectory()) {
          const subFiles = await this.getDirectoryFiles(fullPath)
          fileItems.push(...subFiles)
        } else {
          const stat = await fs.stat(fullPath)
          fileItems.push({
            name: file.name,
            path: fullPath,
            sizeMB: stat.size / (1024 * 1024),
            birthtime: stat.birthtime.toISOString()
          })
        }
      }
    } catch {
      // 忽略读取错误
    }
    return fileItems
  }

  /**
   * 扫描附件根目录，按会话分组返回其关联的文件列表
   */
  public async listSessionGroups(activeSessionIds: Set<string>): Promise<SessionAttachmentGroup[]> {
    const groups: SessionAttachmentGroup[] = []
    let attachBase: string
    try {
      attachBase = await this.pathProvider.getAttachmentsBaseDirectory()
      if (!existsSync(attachBase)) {
        return []
      }
    } catch {
      return []
    }

    try {
      const folders = await fs.readdir(attachBase, { withFileTypes: true })

      for (const folder of folders) {
        if (!folder.isDirectory() || folder.name === 'avatars') {
          continue
        }

        const sessionId = folder.name
        const fullDir = path.join(attachBase, sessionId)
        const files = await this.getDirectoryFiles(fullDir)

        // 如果没有文件，自动清理空目录
        if (files.length === 0) {
          try {
            await fs.rm(fullDir, { recursive: true, force: true })
          } catch {}
          continue
        }

        const totalSizeMB = files.reduce((sum, f) => sum + f.sizeMB, 0)

        groups.push({
          sessionId,
          isOrphan: !activeSessionIds.has(sessionId),
          totalSizeMB,
          fileCount: files.length,
          files
        })
      }
    } catch (e) {
      console.error('[AttachmentManager] Error listing session groups:', e)
    }

    return groups
  }

  /**
   * 删除会话目录下的特定附件文件，并清理可能遗留下来的空会话目录
   */
  public async deleteFile(sessionId: string, fileName: string): Promise<void> {
    const attachBase = await this.pathProvider.getAttachmentsBaseDirectory()
    const safeSessionId = sessionId.replace(/[/\\]/g, '')
    const safeFileName = fileName.replace(/[/\\]/g, '')

    if (safeSessionId === 'avatars' || safeSessionId.trim() === '' || safeFileName.trim() === '') {
      return
    }

    const targetPath = path.join(attachBase, safeSessionId, safeFileName)
    try {
      if (existsSync(targetPath)) {
        await fs.rm(targetPath, { force: true })
      }

      // 检查该会话的附件目录，如果为空，则自动将该目录删除
      const dirPath = path.dirname(targetPath)
      if (existsSync(dirPath)) {
        const remaining = await fs.readdir(dirPath)
        if (remaining.length === 0) {
          await fs.rm(dirPath, { recursive: true, force: true })
        }
      }
    } catch (e) {
      console.error(`[AttachmentManager] Failed to delete attachment file ${targetPath}:`, e)
    }
  }

  /**
   * 辅助方法：从 Markdown 或 HTML 正文中，使用正则提取出所有引用的附件文件名（统一转为小写）
   */
  private extractReferencedFileNames(content: string): Set<string> {
    const fileNames = new Set<string>()

    // 1. 匹配 Obsidian 双链: ![[filename]] 或 [[filename]]
    const obsidianRegex = /!?\[\[([^\]]+)\]\]/g
    let match: RegExpExecArray | null
    while ((match = obsidianRegex.exec(content)) !== null) {
      if (match[1]) {
        // 清理 Obsidian 别名，比如 [[filename.png|200]] 
        const cleanPath = match[1].split('|')[0]?.trim()
        if (cleanPath) {
          fileNames.add(path.basename(safeDecodeURIComponent(cleanPath)).toLowerCase())
        }
      }
    }

    // 2. 匹配 Markdown 链接/图片: ![alt](path) 或 [link](path)
    const mdRegex = /!?\[[^\]]*\]\(([^)]+)\)/g
    while ((match = mdRegex.exec(content)) !== null) {
      if (match[1]) {
        // 去除可能的 query 传参或 hash 锚点
        const cleanPath = match[1].split('?')[0]?.split('#')[0]?.trim()
        if (cleanPath) {
          fileNames.add(path.basename(safeDecodeURIComponent(cleanPath)).toLowerCase())
        }
      }
    }

    // 3. 匹配 HTML 元素链接: src="path" 或 href="path"
    const htmlRegex = /(?:src|href)="([^"]+)"/g
    while ((match = htmlRegex.exec(content)) !== null) {
      if (match[1]) {
        const cleanPath = match[1].split('?')[0]?.split('#')[0]?.trim()
        if (cleanPath) {
          fileNames.add(path.basename(safeDecodeURIComponent(cleanPath)).toLowerCase())
        }
      }
    }

    return fileNames
  }

  public async listDiaryAttachments(): Promise<DiaryAttachmentFileItem[]> {
    const list: DiaryAttachmentFileItem[] = []
    let journalsDir: string
    try {
      journalsDir = await this.pathProvider.getJournalsBaseDirectory()
      if (!existsSync(journalsDir)) {
        return []
      }
    } catch {
      return []
    }

    try {
      // 1. 扫描年份目录 (格式如: 2026)
      const years = await fs.readdir(journalsDir, { withFileTypes: true })
      for (const yearDir of years) {
        if (!yearDir.isDirectory() || !/^\d{4}$/.test(yearDir.name)) {
          continue
        }

        const yearPath = path.join(journalsDir, yearDir.name)
        // 2. 扫描月份目录 (格式如: 05)
        const months = await fs.readdir(yearPath, { withFileTypes: true })
        for (const monthDir of months) {
          if (!monthDir.isDirectory() || !/^\d{2}$/.test(monthDir.name)) {
            continue
          }

          const monthPath = path.join(yearPath, monthDir.name)
          const attachDir = path.join(monthPath, 'attachment')

          // 如果此月份根本没有 attachment 目录，直接跳过
          if (!existsSync(attachDir)) {
            continue
          }

          // 3. 扫描该月份下的物理附件
          const attachFiles = await fs.readdir(attachDir, { withFileTypes: true })
          const monthFiles = attachFiles.filter((f) => f.isFile())

          if (monthFiles.length === 0) {
            continue
          }

          // 4. 读取此年月下的所有日记 Markdown 文件，提取引用并缓存全文
          const referencedNames = new Set<string>()
          const diaryContents: string[] = []
          const siblingFiles = await fs.readdir(monthPath, { withFileTypes: true })
          const diaryFiles = siblingFiles.filter(
            (f) => f.isFile() && /^\d{4}-\d{2}-\d{2}\.md$/.test(f.name)
          )

          for (const df of diaryFiles) {
            try {
              const diaryPath = path.join(monthPath, df.name)
              const content = await fs.readFile(diaryPath, 'utf8')
              diaryContents.push(safeDecodeURIComponent(content).toLowerCase())

              const refs = this.extractReferencedFileNames(content)
              for (const r of refs) {
                referencedNames.add(r)
              }
            } catch (err) {
              console.warn(`[AttachmentManager] Failed to read diary ${df.name}:`, err)
            }
          }

          // 5. 对比物理文件，标记孤立状态并记录
          for (const mf of monthFiles) {
            const fullFilePath = path.join(attachDir, mf.name)
            try {
              const stat = await fs.stat(fullFilePath)
              const relativePath = path.relative(journalsDir, fullFilePath).replace(/\\/g, '/')
              
              const lowerFileName = mf.name.toLowerCase()
              let isOrphan = !referencedNames.has(lowerFileName)

              // 二次兜底逻辑：若正则没找对，但日记正文或 frontmatter 的 JSON 字符串里包含这个文件名，则判定其非孤立
              if (isOrphan && diaryContents.length > 0) {
                const isMentioned = diaryContents.some((content) => content.includes(lowerFileName))
                if (isMentioned) {
                  isOrphan = false
                }
              }

              list.push({
                name: mf.name,
                path: fullFilePath,
                relativePath,
                sizeMB: stat.size / (1024 * 1024),
                birthtime: stat.birthtime.toISOString(),
                yearMonth: `${yearDir.name}-${monthDir.name}`,
                isOrphan
              })
            } catch (err) {
              console.warn(`[AttachmentManager] Failed to stat file ${mf.name}:`, err)
            }
          }
        }
      }
    } catch (e) {
      console.error('[AttachmentManager] Error listing diary attachments:', e)
    }

    return list
  }

  public async deleteDiaryAttachment(filePath: string): Promise<void> {
    try {
      if (existsSync(filePath)) {
        await fs.unlink(filePath)
      }

      // 递归向上清理空目录 (attachment/ -> month/ -> year/)
      let currentDir = path.dirname(filePath)
      let journalsDir = await this.pathProvider.getJournalsBaseDirectory()

      while (currentDir !== journalsDir && currentDir.startsWith(journalsDir)) {
        if (existsSync(currentDir)) {
          const files = await fs.readdir(currentDir)
          if (files.length === 0) {
            await fs.rmdir(currentDir)
            currentDir = path.dirname(currentDir)
          } else {
            break // 目录非空，停止向上清理
          }
        } else {
          break
        }
      }
    } catch (e) {
      console.error(`[AttachmentManager] Failed to delete diary attachment file ${filePath}:`, e)
    }
  }
}
