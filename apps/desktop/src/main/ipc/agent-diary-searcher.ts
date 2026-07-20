import {
  ensureDiaryInlineTags,
  formatDiaryPreviewText,
  prepareDiaryAppendContent,
  prepareDiaryWriteContent,
  parseDateStr,
  resolveDiaryEditMode,
  mergeDiaryTags,
  logger
} from '@baishou/shared'
import { getActiveVaultShadowRepo } from './vault.ipc'
import { settingsManager } from './settings.ipc'
import { getDiaryManager } from './diary.ipc'

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
export function createDiarySearcher() {
  try {
    const shadowRepo = getActiveVaultShadowRepo()
    return {
      async searchFTS(query: string, limit?: number) {
        const results = await shadowRepo.searchFTS(query, limit)
        // 需要将 rowid 映射为 date 字符串
        const allRecords = await shadowRepo.getAllRecords()
        const idToDateMap = new Map(allRecords.map((r) => [r.id, r.date]))
        return results.map((r) => ({
          date: idToDateMap.get(r.rowid) || '',
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
        const diaryService = getDiaryManager()
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
      async writeEntry(date: string, content: string, tags?: string) {
        try {
          const diaryService = getDiaryManager()
          const templateConfig = (await settingsManager.get<any>('diary_template_config')) || {}
          const tagsStr = tags
            ?.split(',')
            .map((s) => s.trim())
            .filter(Boolean)
            .join(',')
          const prepared = prepareDiaryWriteContent(content, templateConfig, new Date())
          // 标签只写正文 #标签，不写 frontmatter（由正文解析进索引）
          const finalContent = tagsStr ? ensureDiaryInlineTags(prepared, tagsStr) : prepared
          await diaryService.create({
            date: parseDateStr(date),
            content: finalContent
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
      async editEntry({ date, content, mode, tags }) {
        try {
          const diaryService = getDiaryManager()
          const existing = await diaryService.findByDate(parseDateStr(date))
          if (!existing?.id) {
            return {
              ok: false as const,
              message: `Error: Diary entry for ${date} does not exist. Use diary_write to create it instead.`
            }
          }

          let finalContent = content
          const editMode = resolveDiaryEditMode(mode)
          if (editMode === 'append') {
            const templateConfig = (await settingsManager.get<any>('diary_template_config')) || {}
            finalContent = prepareDiaryAppendContent(
              existing.content,
              content,
              templateConfig,
              new Date()
            )
          }

          const mergedTags = tags ? mergeDiaryTags(existing.tags, tags) : existing.tags
          // 标签只写正文 #标签；清空 metadata tags，避免再落 frontmatter
          if (mergedTags) {
            finalContent = ensureDiaryInlineTags(finalContent, mergedTags)
          }

          await diaryService.update(existing.id, {
            content: finalContent,
            tags: ''
          })
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
          const diaryService = getDiaryManager()
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
