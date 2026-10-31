import {
  formatDiaryPreviewText,
  parseDateStr,
  prepareDiarySearcherEdit,
  prepareDiarySearcherWrite,
  logger
} from '@baishou/shared'
import { ShadowIndexRepository, shadowConnectionManager } from '@baishou/database-desktop'
import { getActiveVaultShadowRepo, resolveVaultIdByName, vaultService } from './vault.ipc'
import { getDiaryManager } from './diary.ipc'
import { getDiaryManagerForVault } from '../services/diary-vault.factory'

function previewDiaryRow(raw: string | null | undefined): string {
  const cleaned = formatDiaryPreviewText(raw)
  const firstLine = cleaned
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 0 && !l.startsWith('#') && !l.startsWith('---'))
  if (!firstLine) return '(empty)'
  return firstLine.length > 80 ? `${firstLine.slice(0, 80)}...` : firstLine
}

/** 创建日记 FTS5 搜索适配器，注入到 ToolContext 供 diary_search 工具使用 */
export function createDiarySearcher(target?: { vaultId?: string; vaultName?: string }) {
  try {
    const targetVaultName = target?.vaultName?.trim()
    const shadowRepo = targetVaultName
      ? new ShadowIndexRepository(
          shadowConnectionManager.getDb(),
          target?.vaultId || resolveVaultIdByName(targetVaultName)
        )
      : getActiveVaultShadowRepo()
    const resolveDiaryService = async () => {
      if (targetVaultName && vaultService.getActiveVault()?.name !== targetVaultName) {
        return getDiaryManagerForVault(targetVaultName)
      }
      return getDiaryManager()
    }

    return {
      async searchFTS(query: string, limit?: number) {
        const results = await shadowRepo.searchFTS(query, limit)
        return results.map((r) => ({
          date: r.indexRow?.date || '',
          contentSnippet: r.contentSnippet,
          tags: r.tags,
          rankScore: r.rankScore
        }))
      },
      async listInDateRange(startDate: string, endDate: string) {
        const rows = await shadowRepo.findByDateRange(startDate, endDate)
        return rows.map((row) => ({
          date: row.date,
          preview: previewDiaryRow((row as { rawContent?: string | null }).rawContent)
        }))
      },
      async readByDates(dates: string[]) {
        const diaryService = await resolveDiaryService()
        const rows: Array<{ date: string; content: string | null }> = []
        for (const date of dates) {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            rows.push({ date, content: null })
            continue
          }
          const diary = await diaryService.findByDate(parseDateStr(date))
          rows.push({ date, content: diary?.content ?? null })
        }
        return rows
      },
      async writeEntry(date: string, content: string) {
        try {
          const diaryService = await resolveDiaryService()
          await diaryService.create({
            date: parseDateStr(date),
            ...prepareDiarySearcherWrite(content)
          })
          return { ok: true as const }
        } catch (e) {
          if (e instanceof Error && e.name === 'DiaryDateConflictError') {
            return {
              ok: false as const,
              message: `Error: A diary entry for ${date} already exists. Use diary_edit to modify it.`
            }
          }
          return {
            ok: false as const,
            message: `Error: Failed to create diary entry: ${e instanceof Error ? e.message : String(e)}`
          }
        }
      },
      async editEntry({ date, content, mode }) {
        try {
          const diaryService = await resolveDiaryService()
          const existing = await diaryService.findByDate(parseDateStr(date))
          if (!existing?.id) {
            return {
              ok: false as const,
              message: `Error: Diary entry for ${date} does not exist. Use diary_write to create it instead.`
            }
          }

          await diaryService.update(
            existing.id,
            prepareDiarySearcherEdit(existing.content, content, mode)
          )
          return { ok: true as const }
        } catch (e) {
          return {
            ok: false as const,
            message: `Error: Failed to edit diary: ${e instanceof Error ? e.message : String(e)}`
          }
        }
      },
      async deleteEntry(date: string) {
        try {
          const diaryService = await resolveDiaryService()
          const existing = await diaryService.findByDate(parseDateStr(date))
          if (!existing?.id) {
            return {
              ok: false as const,
              message: `Error: Could not find diary entry for ${date} to delete.`
            }
          }
          await diaryService.delete(existing.id)
          return { ok: true as const }
        } catch (e) {
          return {
            ok: false as const,
            message: `Error: Failed to delete diary: ${e instanceof Error ? e.message : String(e)}`
          }
        }
      }
    }
  } catch (e) {
    logger.warn(
      '[Agent] createDiarySearcher failed; diary CRUD tools will be unavailable:',
      e instanceof Error ? e.message : String(e)
    )
    return undefined
  }
}
