import type { SessionManagerService } from '@baishou/core-mobile'
import type { SessionRepository, InsertPartInput } from '@baishou/database'
import type { IFileSystem, IStoragePathService } from '@baishou/core-mobile'
import {
  processAgentAttachments,
  stripAttachmentBinaryForStorage,
  type AttachmentInput
} from './mobile-agent-attachment.util'

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export type SaveUserMessageResult =
  | { userMessageId: string; attachments?: unknown[] }
  | { error: string }

/**
 * 将用户消息写入 SQLite（对齐桌面 agent:save-user-message）。
 */
export async function saveUserMessage(
  sessionRepo: SessionRepository,
  sessionManager: SessionManagerService,
  pathService: IStoragePathService | null,
  fileSystem: IFileSystem | null,
  args: {
    sessionId: string
    text: string
    attachments?: unknown[]
    modelId?: string
    providerType?: string
  }
): Promise<SaveUserMessageResult> {
  try {
    const existing = await sessionRepo.getSessionById(args.sessionId)
    if (!existing) {
      return { error: `Session ${args.sessionId} not found` }
    }

    let attachments = args.attachments as AttachmentInput[] | undefined
    if (pathService && fileSystem && attachments?.length) {
      attachments = await processAgentAttachments(
        pathService,
        fileSystem,
        args.sessionId,
        attachments,
        args.modelId || existing.modelId || '',
        args.providerType || ''
      )
    }

    const history = await sessionRepo.getMessagesBySession(args.sessionId, 1)
    const lastOrder = history.length > 0 && history[0] ? history[0].orderIndex : 0
    const userOrderIndex = lastOrder + 1
    const userMsgId = generateUUID()

    const initialParts: Array<{
      id: string
      messageId: string
      sessionId: string
      type: 'text' | 'image' | 'attachment'
      data: unknown
    }> = [
      {
        id: generateUUID(),
        messageId: userMsgId,
        sessionId: args.sessionId,
        type: 'text',
        data: { text: args.text }
      }
    ]

    if (attachments && attachments.length > 0) {
      for (const att of attachments) {
        initialParts.push({
          id: generateUUID(),
          messageId: userMsgId,
          sessionId: args.sessionId,
          type: att.isImage ? 'image' : 'attachment',
          data: stripAttachmentBinaryForStorage(att)
        })
      }
    }

    await sessionManager.insertMessageWithParts(
      { id: userMsgId, sessionId: args.sessionId, role: 'user', orderIndex: userOrderIndex },
      initialParts as InsertPartInput[]
    )

    return { userMessageId: userMsgId, attachments }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return { error: msg || 'Save failed' }
  }
}
