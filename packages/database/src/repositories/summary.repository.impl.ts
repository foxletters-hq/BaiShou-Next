import {
  Summary,
  CreateSummaryInput,
  UpdateSummaryInput,
  SummaryType,
  formatLocalDate,
  deriveLegacyVaultId,
  isVaultId
} from '@baishou/shared'
import { SummaryRepository } from './summary.repository'
import { summariesTable } from '../schema/summaries'
import { eq, and, gte, sql } from 'drizzle-orm'
import { AppDatabase } from '../types'
import { withExpoAgentDatabaseLock } from '../expo-agent-db.lock'

type VaultIdResolver = () => string | null | undefined

function normalizeVaultId(raw: string | null | undefined): string | null {
  const value = String(raw ?? '').trim()
  if (!value) return null
  return isVaultId(value) ? value : deriveLegacyVaultId(value)
}

export class SummaryRepositoryImpl implements SummaryRepository {
  constructor(
    private readonly db: AppDatabase,
    /** 活跃仓库 ID；查询/写入缺省 vaultId 时使用 */
    private readonly resolveVaultId?: VaultIdResolver
  ) {}

  private run<T>(fn: () => Promise<T>): Promise<T> {
    return withExpoAgentDatabaseLock(this.db, fn)
  }

  private requireVaultId(override?: string | null): string {
    const id = normalizeVaultId(override) ?? normalizeVaultId(this.resolveVaultId?.())
    if (!id) {
      throw new Error('SummaryRepository: vault_id is required')
    }
    return id
  }

  /** 无活跃 vault 时 fail-closed：读接口返回空而非全表 */
  private tryVaultId(override?: string | null): string | null {
    return normalizeVaultId(override) ?? normalizeVaultId(this.resolveVaultId?.())
  }

  async save(summary: CreateSummaryInput): Promise<Summary> {
    return this.run(async () => {
      const vaultId = this.requireVaultId(summary.vaultId)
      const result = await this.db
        .insert(summariesTable)
        .values({
          vaultId,
          type: summary.type,
          startDate: summary.startDate,
          endDate: summary.endDate,
          content: summary.content,
          sourceIds: summary.sourceIds ?? null
        })
        .returning()

      return result[0] as unknown as Summary
    })
  }

  async upsert(summary: CreateSummaryInput): Promise<Summary> {
    return this.run(async () => {
      const vaultId = this.requireVaultId(summary.vaultId)
      const result = await this.db
        .insert(summariesTable)
        .values({
          vaultId,
          type: summary.type,
          startDate: summary.startDate,
          endDate: summary.endDate,
          content: summary.content,
          sourceIds: summary.sourceIds ?? null
        })
        .onConflictDoUpdate({
          target: [
            summariesTable.vaultId,
            summariesTable.type,
            summariesTable.startDate,
            summariesTable.endDate
          ],
          set: { content: summary.content, sourceIds: summary.sourceIds ?? null }
        })
        .returning()
      return result[0] as unknown as Summary
    })
  }

  async update(id: number, summary: UpdateSummaryInput): Promise<Summary> {
    return this.run(async () => {
      const { vaultId: _ignored, ...patch } = summary as UpdateSummaryInput & {
        vaultId?: string
      }
      const result = await this.db
        .update(summariesTable)
        .set({
          ...patch
        })
        .where(eq(summariesTable.id, id))
        .returning()

      if (!result.length) {
        throw new Error(`Summary with id ${id} not found.`)
      }

      return result[0] as unknown as Summary
    })
  }

  async getByDateRange(
    type: SummaryType,
    start: Date,
    end: Date,
    vaultId?: string | null
  ): Promise<Summary | null> {
    return this.run(async () => {
      const scoped = this.tryVaultId(vaultId)
      if (!scoped) return null

      const result = await this.db
        .select()
        .from(summariesTable)
        .where(
          and(
            eq(summariesTable.vaultId, scoped),
            eq(summariesTable.type, type),
            eq(summariesTable.startDate, start),
            eq(summariesTable.endDate, end)
          )
        )
        .limit(1)

      return (result[0] as unknown as Summary) ?? null
    })
  }

  async findAllByTypeAndStartDay(
    type: SummaryType,
    startDate: Date,
    vaultId?: string | null
  ): Promise<Summary[]> {
    return this.run(async () => {
      const scoped = this.tryVaultId(vaultId)
      if (!scoped) return []

      const dayKey = formatLocalDate(startDate)
      const rows = await this.db
        .select()
        .from(summariesTable)
        .where(and(eq(summariesTable.vaultId, scoped), eq(summariesTable.type, type)))
      return (rows as unknown as Summary[]).filter((row) => {
        const start = row.startDate instanceof Date ? row.startDate : new Date(row.startDate)
        return formatLocalDate(start) === dayKey
      })
    })
  }

  async getSummaries(options?: { start?: Date; vaultId?: string | null }): Promise<Summary[]> {
    return this.run(async () => {
      const scoped = this.tryVaultId(options?.vaultId)
      if (!scoped) return []

      const conditions = [eq(summariesTable.vaultId, scoped)]
      if (options?.start) {
        conditions.push(gte(summariesTable.startDate, options.start))
      }

      const rows = await this.db
        .select()
        .from(summariesTable)
        .where(and(...conditions))
      return rows as unknown as Summary[]
    })
  }

  async countByType(vaultId?: string | null): Promise<Partial<Record<SummaryType, number>>> {
    return this.run(async () => {
      const scoped = this.tryVaultId(vaultId)
      if (!scoped) return {}

      const rows = await this.db
        .select({
          type: summariesTable.type,
          count: sql<number>`count(*)`
        })
        .from(summariesTable)
        .where(eq(summariesTable.vaultId, scoped))
        .groupBy(summariesTable.type)

      const result: Partial<Record<SummaryType, number>> = {}
      for (const row of rows) {
        result[row.type as SummaryType] = Number(row.count) || 0
      }
      return result
    })
  }

  async delete(id: number): Promise<void> {
    return this.run(async () => {
      await this.db.delete(summariesTable).where(eq(summariesTable.id, id))
    })
  }

  async deleteAll(vaultId?: string | null): Promise<void> {
    return this.run(async () => {
      const scoped = this.tryVaultId(vaultId)
      if (!scoped) {
        // fail-closed：无 vault 不整表清空
        return
      }
      await this.db.delete(summariesTable).where(eq(summariesTable.vaultId, scoped))
    })
  }
}
