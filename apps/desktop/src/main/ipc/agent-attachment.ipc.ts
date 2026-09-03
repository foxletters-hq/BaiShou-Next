import { ipcMain, dialog, BrowserWindow } from 'electron'
import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'
import {
  classifyPromptAttachmentKind,
  logger,
  normalizeFileCiteRefs,
  supportsNativePdf,
  stripAttachmentBinaryForStorage
} from '@baishou/shared'
import { pathService } from './vault.ipc'
import { getAgentManagers, getActiveProvider } from './agent-helpers'
import { getWorkspaceSessionBinding } from '../services/agent-workspace-session.store'
import {
  decorateWorkspacePromptAttachment,
  planWorkspacePromptAttachment
} from '../services/workspace-prompt-attachment.util'

function isEphemeralAttachmentPath(filePath?: string): boolean {
  if (!filePath) return true
  return filePath.startsWith('blob:') || filePath.startsWith('data:')
}

function inferAttachmentExt(att: {
  data?: string
  fileName?: string
  mimeType?: string
  isPdf?: boolean
}): string {
  if (att.isPdf) return '.pdf'
  const fromName = att.fileName ? path.extname(att.fileName) : ''
  if (fromName) return fromName

  const mime = att.mimeType || ''
  const mimeMap: Record<string, string> = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/bmp': '.bmp',
    'application/pdf': '.pdf'
  }
  if (mimeMap[mime]) return mimeMap[mime]

  const match = String(att.data || '').match(/^data:([^;]+);base64,/)
  if (match) {
    const subtype = match[1]!.split('/')[1]?.toLowerCase()
    if (subtype === 'jpeg') return '.jpg'
    if (subtype) return `.${subtype}`
  }
  return '.png'
}

function mimeTypeFromExt(ext: string): string {
  switch (ext.toLowerCase()) {
    case '.png':
      return 'image/png'
    case '.gif':
      return 'image/gif'
    case '.webp':
      return 'image/webp'
    case '.bmp':
      return 'image/bmp'
    case '.pdf':
      return 'application/pdf'
    default:
      return 'image/jpeg'
  }
}

export function registerAttachmentIPC() {
  // ==========================================
  // API: 保存用户消息及其附件并处理文本提取
  // ==========================================
  ipcMain.handle(
    'agent:save-user-message',
    async (
      _,
      args: {
        sessionId: string
        text: string
        attachments?: any[]
        displayText?: string
        skillRefs?: Array<{ command: string; content: string }>
        fileRefs?: Array<{
          relativePath?: string
          selection?: { startLine?: number; endLine?: number }
          comment?: string
          origin?: string
        }>
      }
    ) => {
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

        // 处理附件：伙伴会话复制到附件库；工作台图片做本机快照，其余记原路径
        let finalAttachments = args.attachments
        const workspaceBinding = await getWorkspaceSessionBinding(args.sessionId)
        if (finalAttachments && finalAttachments.length > 0 && workspaceBinding?.folderRoot) {
          const safeSessionId = args.sessionId.replace(/[\\/]/g, '')
          const snapshotDir = path.join(os.tmpdir(), 'baishou-workbench-prompt', safeSessionId)
          finalAttachments = await Promise.all(
            finalAttachments.map(async (att) => {
              const plan = planWorkspacePromptAttachment(att)
              if (plan.mode === 'path-ref') {
                return decorateWorkspacePromptAttachment({
                  absolutePath: plan.absolutePath,
                  fileName: plan.fileName,
                  folderRoot: workspaceBinding.folderRoot,
                  mimeType: att.mimeType,
                  selection: att.selection,
                  comment: att.comment,
                  origin: att.origin
                })
              }
              if (plan.mode === 'image-snapshot') {
                const ext = path.extname(plan.fileName) || path.extname(plan.absolutePath) || '.png'
                const originalName = path.parse(plan.fileName).name || 'image'
                const snapshotName = `${originalName}_${Date.now()}${ext}`
                await fs.mkdir(snapshotDir, { recursive: true })
                const destPath = path.join(snapshotDir, snapshotName)
                try {
                  await fs.copyFile(plan.absolutePath, destPath)
                  return decorateWorkspacePromptAttachment({
                    absolutePath: destPath,
                    fileName: plan.fileName,
                    mimeType: att.mimeType
                  })
                } catch (error) {
                  logger.error('Failed to snapshot workbench image attachment', {
                    path: plan.absolutePath,
                    error
                  })
                  return decorateWorkspacePromptAttachment({
                    absolutePath: plan.absolutePath,
                    fileName: plan.fileName,
                    folderRoot: workspaceBinding.folderRoot,
                    mimeType: att.mimeType
                  })
                }
              }
              if (plan.mode === 'ephemeral' && att.data) {
                const ext = inferAttachmentExt(att)
                const originalName = path.parse(att.fileName || 'pasted').name || 'pasted'
                const newFileName = `${originalName}_${Date.now()}${ext}`
                await fs.mkdir(snapshotDir, { recursive: true })
                const destPath = path.join(snapshotDir, newFileName)
                const buffer = Buffer.from(
                  String(att.data).replace(/^data:[^;]+;base64,/, ''),
                  'base64'
                )
                await fs.writeFile(destPath, buffer)
                return decorateWorkspacePromptAttachment({
                  absolutePath: destPath,
                  fileName: att.fileName || newFileName,
                  mimeType: att.mimeType
                })
              }
              return stripAttachmentBinaryForStorage(att)
            })
          )
        } else if (finalAttachments && finalAttachments.length > 0) {
          try {
            const attachBase = await pathService.getAttachmentsBaseDirectory()
            const safeSessionId = args.sessionId.replace(/[\\/]/g, '')
            const sessionAttachDir = path.join(attachBase, safeSessionId)

            await fs.mkdir(sessionAttachDir, { recursive: true })

            finalAttachments = await Promise.all(
              finalAttachments.map(async (att) => {
                if (att.data && isEphemeralAttachmentPath(att.filePath)) {
                  const ext = inferAttachmentExt(att)
                  const originalName = path.parse(att.fileName || 'pasted').name || 'pasted'
                  const newFileName = `${originalName}_${Date.now()}${ext}`
                  const destPath = path.join(sessionAttachDir, newFileName)
                  try {
                    const buffer = Buffer.from(
                      String(att.data).replace(/^data:[^;]+;base64,/, ''),
                      'base64'
                    )
                    await fs.writeFile(destPath, buffer)
                    att.url = `file:///${destPath.replace(/\\/g, '/')}`
                    att.filePath = destPath
                    att.fileName = newFileName
                    att.name = newFileName

                    const flags = classifyPromptAttachmentKind(newFileName)
                    const isImage = flags.isImage
                    const isText = flags.isText
                    const isPdf = flags.isPdf
                    att.isImage = isImage
                    att.isText = isText
                    att.isPdf = isPdf
                    if (isImage) {
                      att.type = 'image'
                      att.mimeType = mimeTypeFromExt(path.extname(newFileName))
                    } else if (isPdf) {
                      att.type = 'file'
                      att.mimeType = 'application/pdf'
                    }
                    delete att.data
                  } catch (e: any) {
                    logger.error('Failed to write base64 attachment', e)
                  }
                } else if (
                  att.filePath &&
                  att.fileName &&
                  !isEphemeralAttachmentPath(att.filePath)
                ) {
                  const ext = path.extname(att.filePath) || path.extname(att.fileName)
                  const originalName = path.parse(att.fileName).name
                  const newFileName = `${originalName}_${Date.now()}${ext}`
                  const destPath = path.join(sessionAttachDir, newFileName)

                  try {
                    await fs.copyFile(att.filePath, destPath)
                    att.url = `file:///${destPath.replace(/\\/g, '/')}`
                    att.filePath = destPath
                    att.fileName = att.fileName || newFileName
                    att.name = att.name || att.fileName

                    const flags = classifyPromptAttachmentKind(newFileName)
                    const isImage = flags.isImage
                    const isText = flags.isText
                    const isPdf = flags.isPdf
                    att.isImage = isImage
                    att.isText = isText
                    att.isPdf = isPdf
                    if (isImage) {
                      att.type = 'image'
                      const ext = path.extname(newFileName).toLowerCase()
                      att.mimeType =
                        ext === '.png'
                          ? 'image/png'
                          : ext === '.gif'
                            ? 'image/gif'
                            : ext === '.webp'
                              ? 'image/webp'
                              : 'image/jpeg'
                    } else if (isPdf) {
                      att.type = 'file'
                      att.mimeType = 'application/pdf'
                    }

                    // 读取文本内容（如果是 txt/md 文件）
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
                          att.textContent =
                            buffer.toString('utf8') + '\n\n[Content truncated due to size limit]'
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
                      const nativePdfSupported = supportsNativePdf(
                        activeModelId,
                        activeProviderType
                      )
                      if (!nativePdfSupported) {
                        try {
                          const { readPdfTextFromPath } = await import('@baishou/ai')
                          att.textContent = (await readPdfTextFromPath(destPath)) || ''
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
                }
                return stripAttachmentBinaryForStorage(att)
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

        const skillRefs = Array.isArray(args.skillRefs)
          ? args.skillRefs
              .map((ref) => ({
                command: String(ref?.command ?? '')
                  .trim()
                  .replace(/^\//, ''),
                content: typeof ref?.content === 'string' ? ref.content : ''
              }))
              .filter((ref) => Boolean(ref.command))
          : []
        const fileRefs = normalizeFileCiteRefs(args.fileRefs)
        const rawDisplay =
          typeof args.displayText === 'string' && args.displayText.trim()
            ? args.displayText
            : undefined
        const displayText =
          rawDisplay &&
          (skillRefs.length > 0 ||
            fileRefs.length > 0 ||
            rawDisplay.trim() !== String(args.text ?? '').trim())
            ? rawDisplay
            : undefined

        const initialParts: any[] = [
          {
            id: crypto.randomUUID(),
            messageId: userMsgId,
            sessionId: args.sessionId,
            type: 'text',
            data: {
              text: args.text,
              ...(displayText ? { displayText } : {}),
              ...(skillRefs.length > 0 ? { skillRefs } : {}),
              ...(fileRefs.length > 0 ? { fileRefs } : {})
            }
          }
        ]

        if (finalAttachments && finalAttachments.length > 0) {
          for (const att of finalAttachments) {
            initialParts.push({
              id: crypto.randomUUID(),
              messageId: userMsgId,
              sessionId: args.sessionId,
              // 图片单独封装为 image part（多模态 user message）
              type: att.isImage ? 'image' : 'attachment',
              data: stripAttachmentBinaryForStorage(att)
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
        const fileName = filePath.split(/[/\\]/).pop() || 'Unknown'
        const flags = classifyPromptAttachmentKind(fileName)
        const isImage = flags.isImage
        const isPdf = flags.isPdf
        const isText = flags.isText

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
