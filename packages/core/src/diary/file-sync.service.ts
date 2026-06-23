import { CreateDiaryInput, Diary, formatLocalDate, parseDateStr } from '@baishou/shared'
import type { IFileSystem } from '../fs/file-system.types'
import * as path from '../fs/path.util'
import { IStoragePathService } from '../vault/storage-path.types'
import { parseJournalMarkdown } from './journal-markdown.parser'
import {
  resolveJournalFilePath,
  resolveShadowJournalAbsolutePath
} from '../journal/journal-files.util'

export interface FileSyncService {
  /** @param shadowFilePath 影子索引中的相对路径，用于非标准嵌套布局 */
  writeJournal(diary: CreateDiaryInput | Diary, shadowFilePath?: string): Promise<void>
  /** @param shadowFilePath 影子索引中的相对路径，用于非标准嵌套布局 */
  readJournal(date: Date, shadowFilePath?: string): Promise<Diary | null>
  deleteJournalFile(date: Date, shadowFilePath?: string): Promise<void>
  fullScanVault(): Promise<void>
}

export class FileSyncServiceImpl implements FileSyncService {
  constructor(
    private readonly pathService: IStoragePathService,
    private readonly fileSystem: IFileSystem
  ) {}

  private async ensureDir(dirPath: string): Promise<void> {
    if (!(await this.fileSystem.exists(dirPath))) {
      await this.fileSystem.mkdir(dirPath, { recursive: true })
    }
  }

  private buildFilePath(rootPath: string, date: Date): string {
    const year = String(date.getFullYear())
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const dateStr = formatLocalDate(date)
    return path.join(rootPath, year, month, `${dateStr}.md`)
  }

  private async resolveWriteFilePath(
    rootPath: string,
    date: Date,
    shadowFilePath?: string
  ): Promise<string> {
    const dateStr = formatLocalDate(date)
    const hintPath = shadowFilePath
      ? resolveShadowJournalAbsolutePath(rootPath, shadowFilePath)
      : undefined
    const existingPath = await resolveJournalFilePath(
      this.fileSystem,
      rootPath,
      dateStr,
      hintPath
    )
    return existingPath ?? this.buildFilePath(rootPath, date)
  }

  async writeJournal(diary: CreateDiaryInput | Diary, shadowFilePath?: string): Promise<void> {
    const rootPath = await this.pathService.getJournalsBaseDirectory()
    const filePath = await this.resolveWriteFilePath(rootPath, diary.date, shadowFilePath)

    await this.ensureDir(path.dirname(filePath))

    const lines: string[] = ['---']
    if ('id' in diary && diary.id) lines.push(`id: ${diary.id}`)
    lines.push(`date: ${formatLocalDate(diary.date)}`)

    if (diary.tags) {
      const tagArr = Array.isArray(diary.tags)
        ? diary.tags
        : (diary.tags as string)
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
      if (tagArr.length > 0) lines.push(`tags: [${tagArr.join(', ')}]`)
    }

    if ('tagColors' in diary && diary.tagColors) {
      const colorMap =
        typeof diary.tagColors === 'string'
          ? diary.tagColors
          : JSON.stringify(diary.tagColors)
      if (colorMap && colorMap !== '{}') {
        lines.push(`tag_colors: ${colorMap}`)
      }
    }

    if ('weather' in diary && diary.weather) lines.push(`weather: ${diary.weather}`)
    if ('mood' in diary && diary.mood) lines.push(`mood: ${diary.mood}`)
    if ('location' in diary && diary.location) lines.push(`location: ${diary.location}`)
    if ('locationDetail' in diary && diary.locationDetail)
      lines.push(`location_detail: ${diary.locationDetail}`)
    if ('isFavorite' in diary && diary.isFavorite) lines.push(`is_favorite: true`)

    if ('updatedAt' in diary && diary.updatedAt) {
      lines.push(`updated_at: ${diary.updatedAt.toISOString()}`)
    }

    lines.push('---', '', diary.content)

    await this.fileSystem.writeFile(filePath, lines.join('\n'), 'utf8')
  }

  async readJournal(date: Date, shadowFilePath?: string): Promise<Diary | null> {
    const rootPath = await this.pathService.getJournalsBaseDirectory()
    const dateStr = formatLocalDate(date)
    const hintPath = shadowFilePath
      ? resolveShadowJournalAbsolutePath(rootPath, shadowFilePath)
      : undefined
    const filePath = await resolveJournalFilePath(this.fileSystem, rootPath, dateStr, hintPath)
    if (!filePath) return null

    const raw = await this.fileSystem.readFile(filePath, 'utf8')
    return this._parseMarkdown(raw, date)
  }

  async deleteJournalFile(date: Date, shadowFilePath?: string): Promise<void> {
    const rootPath = await this.pathService.getJournalsBaseDirectory()
    const dateStr = formatLocalDate(date)
    const hintPath = shadowFilePath
      ? resolveShadowJournalAbsolutePath(rootPath, shadowFilePath)
      : undefined
    const filePath = await resolveJournalFilePath(
      this.fileSystem,
      rootPath,
      dateStr,
      hintPath
    )
    if (filePath && (await this.fileSystem.exists(filePath))) {
      await this.fileSystem.unlink(filePath)
    }
  }

  async fullScanVault(): Promise<void> {}

  private _parseMarkdown(raw: string, fallbackDate: Date): Diary | null {
    const parsed = parseJournalMarkdown(raw, formatLocalDate(fallbackDate))
    if (!parsed) {
      return { date: fallbackDate, content: raw.trim() } as Diary
    }

    return {
      id: parsed.id || undefined,
      date: parseDateStr(parsed.date) ?? fallbackDate,
      content: parsed.content,
      tags: parsed.tags.length > 0 ? parsed.tags.join(',') : undefined,
      tagColors:
        Object.keys(parsed.tagColors).length > 0 ? JSON.stringify(parsed.tagColors) : undefined,
      createdAt: parsed.createdAt,
      updatedAt: parsed.updatedAt,
      weather: parsed.weather,
      mood: parsed.mood,
      location: parsed.location,
      locationDetail: parsed.locationDetail,
      isFavorite: parsed.isFavorite,
      mediaPaths: parsed.mediaPaths
    } as Diary
  }
}
