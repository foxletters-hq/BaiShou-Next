import { ipcMain, dialog, BrowserWindow } from 'electron'
import * as fs from 'fs/promises'
import * as path from 'path'
import { logger, supportsNativePdf } from '@baishou/shared'
import { pathService } from './vault.ipc'
import { getAgentManagers, getActiveProvider } from './agent-helpers'

export function registerAttachmentIPC() {
  // ==========================================
  // API: 保存用户消息及其附件并处理文本提取
  // ==========================================
  ipcMain.handle(
    'agent:save-user-message',
    async (_, args: { sessionId: string; text: string; attachments?: any[] }) => {
      try {
        const managers = getAgentManagers()
        const existingSession = await managers.realSessionRepo.getSessionById(args.sessionId)
        if (!existingSession) {
          throw new Error(
            `[CRITICAL BUG] 试图保存消息时，在数据库中找不到 sessionId=${args.sessionId}！`
          )
        }
        const activeModelId = existingSession.modelId
        const activeProviderId = existingSession.providerId
        let activeProviderType = ''
        try {
          const providerInstance = await getActiveProvider(activeProviderId)
          activeProviderType = providerInstance.config.type || ''
        } catch (provErr) {
          logger.warn('Failed to resolve provider type for session', { error: provErr as any })
        }

        // 处理附件：复制到会话目录
        let finalAttachments = args.attachments
        if (finalAttachments && finalAttachments.length > 0) {
          try {
            const attachBase = await pathService.getAttachmentsBaseDirectory()
            const safeSessionId = args.sessionId.replace(/[\\/]/g, '')
            const sessionAttachDir = path.join(attachBase, safeSessionId)

            await fs.mkdir(sessionAttachDir, { recursive: true })

            finalAttachments = await Promise.all(
              finalAttachments.map(async (att) => {
                if (att.filePath && att.fileName) {
                  const ext = path.extname(att.filePath) || path.extname(att.fileName)
                  const originalName = path.parse(att.fileName).name
                  const newFileName = `${originalName}_${Date.now()}${ext}`
                  const destPath = path.join(sessionAttachDir, newFileName)

                  try {
                    await fs.copyFile(att.filePath, destPath)
                    att.url = `file:///${destPath.replace(/\\/g, '/')}`
                    att.filePath = destPath

                    // 读取文本内容（如果是 txt/md 文件）
                    const isText = /\.(txt|md)$/i.test(newFileName)
                    const isPdf = /\.pdf$/i.test(newFileName)
                    if (isText) {
                      try {
                        const stats = await fs.stat(destPath)
                        const MAX_SIZE = 512 * 1024 // 512 KB
                        if (stats.size > MAX_SIZE) {
                          // 仅读取前 512KB
                          const fd = await fs.open(destPath, 'r')
                          const buffer = Buffer.alloc(MAX_SIZE)
                          await fd.read(buffer, 0, MAX_SIZE, 0)
                          await fd.close()
                          att.textContent = buffer.toString('utf8') + '\n\n[Content truncated due to size limit]'
                        } else {
                          att.textContent = await fs.readFile(destPath, 'utf8')
                        }
                        att.isText = true
                      } catch (readErr) {
                        logger.error('Failed to read text file content:', {
                          error: readErr as any
                        })
                      }
                    } else if (isPdf) {
                      const nativePdfSupported = supportsNativePdf(activeModelId, activeProviderType)
                      if (!nativePdfSupported) {
                        try {
                          const pdfParse = require('pdf-parse')
                          const dataBuffer = await fs.readFile(destPath)
                          const pdfData = await pdfParse(dataBuffer)
                          att.textContent = pdfData.text || ''
                          att.isText = true
                        } catch (pdfErr) {
                          logger.error('Failed to parse PDF file:', {
                            error: pdfErr as any
                          })
                        }
                      }
                    }
                  } catch (copyErr) {
                    logger.error('Failed to copy attachment:', {
                      path: att.filePath,
                      error: copyErr
                    })
                    att.url = `file:///${att.filePath.replace(/\\/g, '/')}`
                  }
                } else if (att.data && !att.url) {
                  const ext = '.png'
                  const newFileName = `pasted_${Date.now()}${ext}`
                  const destPath = path.join(sessionAttachDir, newFileName)
                  try {
                    const buffer = Buffer.from(
                      att.data.replace(/^data:image\/\w+;base64,/, ''),
                      'base64'
                    )
                    await fs.writeFile(destPath, buffer)
                    att.url = `file:///${destPath.replace(/\\/g, '/')}`
                  } catch (e: any) {
                    logger.error('Failed to copy base64 attachment', e)
                  }
                }
                return att
              })
            )
          } catch (e: any) {
            logger.error('Attachments processing failed:', e)
          }
        }

        const history = await managers.realSessionRepo.getMessagesBySession(args.sessionId, 1)
        const lastOrder = history.length > 0 ? history[0].orderIndex : 0
        const userOrderIndex = lastOrder + 1
        const userMsgId = crypto.randomUUID()

        const initialParts: any[] = [
          {
            id: crypto.randomUUID(),
            messageId: userMsgId,
            sessionId: args.sessionId,
            type: 'text',
            data: { text: args.text }
          }
        ]

        if (finalAttachments && finalAttachments.length > 0) {
          for (const att of finalAttachments) {
            initialParts.push({
              id: crypto.randomUUID(),
              messageId: userMsgId,
              sessionId: args.sessionId,
              type: 'attachment',
              data: att
            })
          }
        }

        await managers.sessionManager.insertMessageWithParts(
          { id: userMsgId, sessionId: args.sessionId, role: 'user', orderIndex: userOrderIndex },
          initialParts
        )
        logger.info(`[Agent:save-user-message] 用户消息已落盘: ${userMsgId}`)

        return { userMessageId: userMsgId, attachments: finalAttachments }
      } catch (e: any) {
        logger.error('[Agent:save-user-message] 保存失败:', e)
        console.error('------- SAVE MSG ERROR DETAILS -------')
        console.error(e)
        if (e.cause) console.error('CAUSE:', e.cause)
        console.error('--------------------------------------')
        return { error: e.message || 'Save failed' }
      }
    }
  )

  // ==========================================
  // API: 系统文件选择器
  // ==========================================
  ipcMain.handle('system:pick-files', async (event, options?: Electron.OpenDialogOptions) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return []

    const defaultOptions: Electron.OpenDialogOptions = {
      title: 'Select Input Attachments',
      properties: ['openFile', 'multiSelections'],
      filters: [
        {
          name: 'Documents & Images',
          extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'pdf', 'txt', 'md']
        },
        { name: 'All Files', extensions: ['*'] }
      ]
    }

    try {
      const result = await dialog.showOpenDialog(window, { ...defaultOptions, ...options })
      if (result.canceled) return []

      const filePromises = result.filePaths.map(async (filePath) => {
        const isImage = /\.(png|jpe?g|gif|webp|bmp)$/i.test(filePath)
        const isPdf = /\.pdf$/i.test(filePath)
        const isText = /\.(txt|md)$/i.test(filePath)
        const fileName = filePath.split(/[/\\]/).pop() || 'Unknown'

        let fileSize = 0
        try {
          const stats = await fs.stat(filePath)
          fileSize = stats.size
        } catch (e) {
          logger.error('Failed to get file size:', { error: e as any })
        }

        return {
          id: Math.random().toString(36).substring(7),
          fileName,
          filePath,
          isImage,
          isPdf,
          isText,
          fileSize
        }
      })
      return Promise.all(filePromises)
    } catch (err: any) {
      logger.error('File Picker Error:', err)
      return []
    }
  })
}
