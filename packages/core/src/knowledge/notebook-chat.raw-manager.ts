import {
  notebookChatTitleFromQuestion,
  parseNotebookChatCitations,
  parseNotebookChatReasoning,
  type NotebookChatCitation,
  type NotebookChatMessageRecord,
  type NotebookChatSessionRecord
} from '@baishou/shared'
import type { NotebookRawManager } from '../raw-data/managers/notebook.raw-manager'

function newChatId(prefix: string): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
  return `${prefix}_${rand}`
}

function sessionsRel(notebookId: string): string {
  return `${notebookId}/chats/sessions.jsonl`
}

function messagesRel(notebookId: string, sessionId: string): string {
  return `${notebookId}/chats/${sessionId}.jsonl`
}

export class NotebookChatRawManager {
  constructor(private readonly notebooks: NotebookRawManager) {}

  async listSessions(notebookId: string): Promise<NotebookChatSessionRecord[]> {
    const rows = await this.notebooks.readJsonlLines<NotebookChatSessionRecord>(
      sessionsRel(notebookId)
    )
    return rows
      .filter((row) => !row.deletedAt && row.notebookId === notebookId)
      .sort((a, b) => {
        const pin = Number(Boolean(b.pinned)) - Number(Boolean(a.pinned))
        if (pin !== 0) return pin
        return (b.updatedAt || 0) - (a.updatedAt || 0)
      })
  }

  async createSession(input: {
    notebookId: string
    assistantId: string
    title?: string
  }): Promise<NotebookChatSessionRecord> {
    const now = Date.now()
    const record: NotebookChatSessionRecord = {
      id: newChatId('ncs'),
      notebookId: input.notebookId,
      assistantId: input.assistantId.trim(),
      title: input.title?.trim() || '',
      pinned: false,
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    }
    await this.notebooks.appendJsonlLine(sessionsRel(input.notebookId), record)
    return record
  }

  async updateSession(
    notebookId: string,
    sessionId: string,
    patch: { title?: string; pinned?: boolean; assistantId?: string; deletedAt?: number | null }
  ): Promise<NotebookChatSessionRecord | null> {
    const current = (await this.listSessions(notebookId)).find((row) => row.id === sessionId)
    if (!current) return null
    const next: NotebookChatSessionRecord = {
      ...current,
      title: patch.title !== undefined ? patch.title.trim() : current.title,
      pinned: patch.pinned !== undefined ? patch.pinned : current.pinned,
      assistantId: patch.assistantId !== undefined ? patch.assistantId.trim() : current.assistantId,
      deletedAt: patch.deletedAt !== undefined ? patch.deletedAt : current.deletedAt,
      updatedAt: Date.now()
    }
    await this.notebooks.appendJsonlLine(sessionsRel(notebookId), next)
    return next.deletedAt ? null : next
  }

  async listMessages(
    notebookId: string,
    sessionId: string
  ): Promise<NotebookChatMessageRecord[]> {
    const rows = await this.notebooks.readJsonlLines<
      NotebookChatMessageRecord & { updatedAt: number }
    >(messagesRel(notebookId, sessionId))
    return rows
      .filter((row) => row.sessionId === sessionId)
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((row) => ({
        id: row.id,
        sessionId: row.sessionId,
        role: row.role,
        text: row.text,
        reasoning: parseNotebookChatReasoning(row.reasoning),
        citations: parseNotebookChatCitations(row.citations),
        createdAt: row.createdAt
      }))
  }

  async appendMessage(input: {
    notebookId: string
    sessionId: string
    role: 'user' | 'assistant'
    text: string
    reasoning?: string
    citations?: NotebookChatCitation[]
  }): Promise<NotebookChatMessageRecord> {
    const now = Date.now()
    const record: NotebookChatMessageRecord & { updatedAt: number } = {
      id: newChatId('ncm'),
      sessionId: input.sessionId,
      role: input.role,
      text: input.text,
      reasoning: parseNotebookChatReasoning(input.reasoning),
      citations: input.citations,
      createdAt: now,
      updatedAt: now
    }
    await this.notebooks.appendJsonlLine(messagesRel(input.notebookId, input.sessionId), record)
    const sessions = await this.listSessions(input.notebookId)
    const session = sessions.find((row) => row.id === input.sessionId)
    if (session) {
      const title =
        session.title.trim() ||
        (input.role === 'user' ? notebookChatTitleFromQuestion(input.text) : session.title)
      await this.notebooks.appendJsonlLine(sessionsRel(input.notebookId), {
        ...session,
        title,
        updatedAt: now
      })
    }
    return {
      id: record.id,
      sessionId: record.sessionId,
      role: record.role,
      text: record.text,
      reasoning: record.reasoning,
      citations: record.citations,
      createdAt: record.createdAt
    }
  }
}
