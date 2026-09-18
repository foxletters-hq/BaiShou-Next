import { and, asc, desc, eq } from 'drizzle-orm'
import { notebooksTable, type NotebookRow } from '../schema/knowledge'
import type { AppDatabase } from '../types'

export class KnowledgeNotebookOps {
  constructor(private readonly db: AppDatabase) {}

  async createNotebook(input: {
    id: string
    name: string
    description?: string
    vaultId: string
    sortOrder?: number
    coverTone?: string
    coverIcon?: string
    coverImage?: string
  }): Promise<NotebookRow> {
    const now = Date.now()
    const vaultId = input.vaultId.trim()
    if (!vaultId) throw new Error('createNotebook: vaultId is required')
    await this.db.insert(notebooksTable).values({
      id: input.id,
      vaultId,
      name: input.name,
      description: input.description ?? '',
      archived: 0,
      sortOrder: input.sortOrder ?? 0,
      coverTone: input.coverTone ?? '',
      coverIcon: input.coverIcon ?? '',
      coverImage: input.coverImage ?? '',
      createdAt: now,
      updatedAt: now
    })
    const row = await this.getNotebook(input.id)
    if (!row) throw new Error(`createNotebook: missing row ${input.id}`)
    return row
  }

  async getNotebook(id: string): Promise<NotebookRow | null> {
    const rows = await this.db
      .select()
      .from(notebooksTable)
      .where(eq(notebooksTable.id, id))
      .limit(1)
    return rows[0] ?? null
  }

  async listNotebooks(options?: {
    includeArchived?: boolean
    vaultId?: string
  }): Promise<NotebookRow[]> {
    const vaultId = options?.vaultId?.trim()
    const archivedOk = options?.includeArchived
    if (vaultId && archivedOk) {
      return this.db
        .select()
        .from(notebooksTable)
        .where(eq(notebooksTable.vaultId, vaultId))
        .orderBy(asc(notebooksTable.sortOrder), desc(notebooksTable.createdAt), notebooksTable.id)
    }
    if (vaultId) {
      return this.db
        .select()
        .from(notebooksTable)
        .where(and(eq(notebooksTable.vaultId, vaultId), eq(notebooksTable.archived, 0)))
        .orderBy(asc(notebooksTable.sortOrder), desc(notebooksTable.createdAt), notebooksTable.id)
    }
    if (archivedOk) {
      return this.db
        .select()
        .from(notebooksTable)
        .orderBy(asc(notebooksTable.sortOrder), desc(notebooksTable.createdAt), notebooksTable.id)
    }
    return this.db
      .select()
      .from(notebooksTable)
      .where(eq(notebooksTable.archived, 0))
      .orderBy(asc(notebooksTable.sortOrder), desc(notebooksTable.createdAt), notebooksTable.id)
  }

  async updateNotebook(
    id: string,
    patch: {
      name?: string
      description?: string
      archived?: boolean
      vaultId?: string
      sortOrder?: number
      coverTone?: string
      coverIcon?: string
      coverImage?: string
    }
  ): Promise<void> {
    const set: Partial<NotebookRow> = { updatedAt: Date.now() }
    if (patch.name !== undefined) set.name = patch.name
    if (patch.description !== undefined) set.description = patch.description
    if (patch.archived !== undefined) set.archived = patch.archived ? 1 : 0
    if (patch.vaultId !== undefined) set.vaultId = patch.vaultId.trim()
    if (patch.sortOrder !== undefined) set.sortOrder = patch.sortOrder
    if (patch.coverTone !== undefined) set.coverTone = patch.coverTone
    if (patch.coverIcon !== undefined) set.coverIcon = patch.coverIcon
    if (patch.coverImage !== undefined) set.coverImage = patch.coverImage
    await this.db.update(notebooksTable).set(set).where(eq(notebooksTable.id, id))
  }
}
