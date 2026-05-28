import { ipcMain, shell, nativeImage } from 'electron'
import { AttachmentManagerService } from '@baishou/core'
import { DesktopStoragePathService } from '../services/path.service'
import { SessionRepository, connectionManager } from '@baishou/database'
import path from 'node:path'
import { existsSync } from 'node:fs'
import { getAttachmentAllowedRoots, isPathUnderAllowedRoots } from './attachment-path-cache'

export function registerAttachmentIPC() {
  const pathService = new DesktopStoragePathService()
  const attachmentManager = new AttachmentManagerService(pathService)

  ipcMain.handle('attachment:listAll', async () => {
    const db = connectionManager.getDb()
    const sessionRepo = new SessionRepository(db)
    // 尽量拉取所有的会话以供标题映射
    const sessions = await sessionRepo.findAllSessions(5000)
    const activeSessionIds = new Set<string>(sessions.map((s) => s.id))

    const groups = await attachmentManager.listSessionGroups(activeSessionIds)

    // 将数据库中的会话标题匹配并写入对应的附件分组
    for (const group of groups) {
      const matched = sessions.find((s) => s.id === group.sessionId)
      if (matched) {
        group.sessionTitle = matched.title || undefined
      }
    }

    return groups
  })

  ipcMain.handle('attachment:deleteBatch', async (_, ids: string[]) => {
    await attachmentManager.deleteBatch(ids)
    return true
  })

  ipcMain.handle('attachment:openInFolder', async (_, absolutePath: string) => {
    try {
      const roots = await getAttachmentAllowedRoots(pathService)
      const resolvedPath = path.resolve(absolutePath)

      // 严格的安全限制：防止目录穿越攻击
      if (!isPathUnderAllowedRoots(resolvedPath, roots)) {
        throw new Error('Access denied: target path is outside allowed directories.')
      }

      shell.showItemInFolder(resolvedPath)
      return true
    } catch (e) {
      console.error('[AttachmentIPC] Error in openInFolder:', e)
      throw e
    }
  })

  ipcMain.handle('attachment:deleteFile', async (_, sessionId: string, fileName: string) => {
    await attachmentManager.deleteFile(sessionId, fileName)
    return true
  })

  ipcMain.handle('attachment:listDiaryAttachments', async () => {
    try {
      return await attachmentManager.listDiaryAttachments()
    } catch (e) {
      console.error('[AttachmentIPC] Error in listDiaryAttachments:', e)
      throw e
    }
  })

  ipcMain.handle('attachment:deleteDiaryAttachment', async (_, filePath: string) => {
    try {
      const journalsBase = await pathService.getJournalsBaseDirectory()
      const resolvedPath = path.resolve(filePath)

      // 严格的安全限制：防止目录穿越攻击
      if (!resolvedPath.startsWith(journalsBase)) {
        throw new Error('Access denied: target path is outside the journals root directory.')
      }

      await attachmentManager.deleteDiaryAttachment(resolvedPath)
      return true
    } catch (e) {
      console.error('[AttachmentIPC] Error in deleteDiaryAttachment:', e)
      throw e
    }
  })

  ipcMain.handle('attachment:getThumbnail', async (_, filePath: string, maxSize: number = 200) => {
    try {
      const resolvedPath = path.resolve(filePath)
      const roots = await getAttachmentAllowedRoots(pathService)
      if (!isPathUnderAllowedRoots(resolvedPath, roots)) {
        throw new Error('Access denied: target path is outside allowed directories.')
      }

      if (!existsSync(resolvedPath)) {
        return null
      }

      // 使用 nativeImage 加载并压缩图片
      const image = nativeImage.createFromPath(resolvedPath)
      if (image.isEmpty()) {
        return null
      }
      const size = image.getSize()

      // 计算缩放比例，保持宽高比
      let width = size.width
      let height = size.height
      if (width > maxSize || height > maxSize) {
        const ratio = Math.min(maxSize / width, maxSize / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }

      // 调整大小并转换为 JPEG 格式的 base64
      const resized = image.resize({ width, height })
      const jpegBuffer = resized.toJPEG(70) // 70% 质量，平衡清晰度和大小

      return `data:image/jpeg;base64,${jpegBuffer.toString('base64')}`
    } catch (e) {
      console.error('[AttachmentIPC] Error in getThumbnail:', e)
      return null
    }
  })

  ipcMain.handle('attachment:getFullImage', async (_, filePath: string) => {
    try {
      const resolvedPath = path.resolve(filePath)
      const roots = await getAttachmentAllowedRoots(pathService)
      if (!isPathUnderAllowedRoots(resolvedPath, roots)) {
        throw new Error('Access denied: target path is outside allowed directories.')
      }

      if (!existsSync(resolvedPath)) {
        return null
      }

      const image = nativeImage.createFromPath(resolvedPath)
      if (image.isEmpty()) {
        return null
      }

      const size = image.getSize()
      const maxDimension = 1920
      let finalImage = image
      if (size.width > maxDimension || size.height > maxDimension) {
        const ratio = Math.min(maxDimension / size.width, maxDimension / size.height)
        finalImage = image.resize({
          width: Math.round(size.width * ratio),
          height: Math.round(size.height * ratio)
        })
      }

      const ext = path.extname(resolvedPath).toLowerCase()
      if (ext === '.png' || ext === '.webp' || ext === '.gif') {
        return `data:image/png;base64,${finalImage.toPNG().toString('base64')}`
      }

      return `data:image/jpeg;base64,${finalImage.toJPEG(85).toString('base64')}`
    } catch (e) {
      console.error('[AttachmentIPC] Error in getFullImage:', e)
      return null
    }
  })
}
