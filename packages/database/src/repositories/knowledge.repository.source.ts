import { and, eq } from 'drizzle-orm'
import { knowledgeSourcesTable, type KnowledgeSourceRow } from '../schema/knowledge'
import type { AppDatabase } from '../types'
import type { KnowledgeSourceStatus } from './knowledge.repository.types'

export class KnowledgeSourceOps {
  constructor(private readonly db: AppDatabase) {}

  async upsertSource(row: {
    id: string
    notebookId: string
    title: string
    sourceKind: string
    vaultId: string
    relativePath?: string | null
    originUrl?: string | null
    contentHash: string
    extractedTextHash?: string | null
    extractEngine?: string
    pageCount?: number | null
    textPageCount?: number | null
    status: KnowledgeSourceStatus | string
    errorMessage?: string | null
    byteSize?: number
  }): Promise<KnowledgeSourceRow> {
    const now = Date.now()
    const vaultId = row.vaultId.trim()
    if (!vaultId) throw new Error('upsertSource: vaultId is required')
    const existing = await this.getSource(row.id)
    if (existing) {
      await this.db
        .update(knowledgeSourcesTable)
        .set({
          vaultId,
          notebookId: row.notebookId,
          title: row.title,
          sourceKind: row.sourceKind,
          relativePath: row.relativePath ?? existing.relativePath,
          originUrl: row.originUrl ?? existing.originUrl,
          contentHash: row.contentHash,
          extractedTextHash:
            row.extractedTextHash !== undefined
              ? row.extractedTextHash
              : existing.extractedTextHash,
          extractEngine: row.extractEngine ?? existing.extractEngine,
          pageCount: row.pageCount !== undefined ? row.pageCount : existing.pageCount,
          textPageCount:
            row.textPageCount !== undefined ? row.textPageCount : existing.textPageCount,
          status: row.status,
          errorMessage: row.errorMessage !== undefined ? row.errorMessage : existing.errorMessage,
          byteSize: row.byteSize ?? existing.byteSize,
          updatedAt: now
        })
        .where(eq(knowledgeSourcesTable.id, row.id))
    } else {
      await this.db.insert(knowledgeSourcesTable).values({
        id: row.id,
        vaultId,
        notebookId: row.notebookId,
        title: row.title,
        sourceKind: row.sourceKind,
        relativePath: row.relativePath ?? null,
        originUrl: row.originUrl ?? null,
        contentHash: row.contentHash,
        extractedTextHash: row.extractedTextHash ?? null,
        extractEngine: row.extractEngine ?? 'simple',
        pageCount: row.pageCount ?? null,
        textPageCount: row.textPageCount ?? null,
        status: row.status,
        errorMessage: row.errorMessage ?? null,
        byteSize: row.byteSize ?? 0,
        createdAt: now,
        updatedAt: now
      })
    }
    const out = await this.getSource(row.id)
    if (!out) throw new Error(`upsertSource: missing ${row.id}`)
    return out
  }

  async getSource(id: string): Promise<KnowledgeSourceRow | null> {
    const rows = await this.db
      .select()
      .from(knowledgeSourcesTable)
      .where(eq(knowledgeSourcesTable.id, id))
      .limit(1)
    return rows[0] ?? null
  }

  async listSources(notebookId: string): Promise<KnowledgeSourceRow[]> {
    return this.db
      .select()
      .from(knowledgeSourcesTable)
      .where(eq(knowledgeSourcesTable.notebookId, notebookId))
      .orderBy(knowledgeSourcesTable.createdAt, knowledgeSourcesTable.id)
  }

  async updateSourceStatus(
    id: string,
    status: KnowledgeSourceStatus | string,
    patch?: {
      errorMessage?: string | null
      extractedTextHash?: string | null
      pageCount?: number | null
      textPageCount?: number | null
      extractEngine?: string
    }
  ): Promise<void> {
    const set: Record<string, unknown> = {
      status,
      updatedAt: Date.now()
    }
    if (patch && 'errorMessage' in patch) set.errorMessage = patch.errorMessage
    if (patch && 'extractedTextHash' in patch) set.extractedTextHash = patch.extractedTextHash
    if (patch && 'pageCount' in patch) set.pageCount = patch.pageCount
    if (patch && 'textPageCount' in patch) set.textPageCount = patch.textPageCount
    if (patch && 'extractEngine' in patch) set.extractEngine = patch.extractEngine
    await this.db.update(knowledgeSourcesTable).set(set).where(eq(knowledgeSourcesTable.id, id))
  }

  async listSourcesByStatus(
    status: KnowledgeSourceStatus | string,
    options?: { vaultId?: string }
  ): Promise<KnowledgeSourceRow[]> {
    const vaultId = options?.vaultId?.trim()
    const filters = [eq(knowledgeSourcesTable.status, status)]
    if (vaultId) filters.push(eq(knowledgeSourcesTable.vaultId, vaultId))
    return this.db
      .select()
      .from(knowledgeSourcesTable)
      .where(and(...filters))
  }
}
