import { CreateDiaryInput, Diary, formatLocalDate, parseDateStr } from '@baishou/shared'
import type { IFileSystem } from '../fs/file-system.types'
import * as path from '../fs/path.util'
import { IStoragePathService } from '../vault/storage-path.types'

export interface FileSyncService {
  writeJournal(diary: CreateDiaryInput | Diary): Promise<void>
  readJournal(date: Date): Promise<Diary | null>
  deleteJournalFile(date: Date): Promise<void>
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

  async writeJournal(diary: CreateDiaryInput | Diary): Promise<void> {
    const rootPath = await this.pathService.getJournalsBaseDirectory()
    const filePath = this.buildFilePath(rootPath, diary.date)

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

  async readJournal(date: Date): Promise<Diary | null> {
    const rootPath = await this.pathService.getJournalsBaseDirectory()
    const filePath = this.buildFilePath(rootPath, date)

    if (!(await this.fileSystem.exists(filePath))) return null

    const raw = await this.fileSystem.readFile(filePath, 'utf8')
    return this._parseMarkdown(raw, date)
  }

  async deleteJournalFile(date: Date): Promise<void> {
    const rootPath = await this.pathService.getJournalsBaseDirectory()
    const filePath = this.buildFilePath(rootPath, date)

    if (await this.fileSystem.exists(filePath)) {
      await this.fileSystem.unlink(filePath)
    }
  }

  async fullScanVault(): Promise<void> {}

  private _parseMarkdown(raw: string, fallbackDate: Date): Diary | null {
    const fmRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/
    const match = raw.match(fmRegex)

    if (!match) {
      return { date: fallbackDate, content: raw.trim() } as Diary
    }

    const rawMeta = match[1] ?? ''
    const body = match[2] ?? ''
    const diary: Partial<Diary> & { date: Date; content: string } = {
      date: fallbackDate,
      content: body.trim()
    }

    for (const line of rawMeta.split('\n')) {
      const colonIdx = line.indexOf(':')
      if (colonIdx === -1) continue
      const key = line.substring(0, colonIdx).trim()
      const val = line.substring(colonIdx + 1).trim()
      if (!key || !val) continue

      switch (key) {
        case 'id':
          diary.id = Number(val)
          break
        case 'date':
          diary.date = parseDateStr(val) ?? fallbackDate
          break
        case 'tags': {
          const clean = val.replace(/^\[/, '').replace(/\]$/, '')
          const tagArr = clean
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
          diary.tags = tagArr.join(',')
          break
        }
        case 'weather':
          diary.weather = val
          break
        case 'mood':
          diary.mood = val
          break
        case 'location':
          diary.location = val
          break
        case 'location_detail':
        case 'locationDetail':
          diary.locationDetail = val
          break
        case 'is_favorite':
        case 'isFavorite':
          diary.isFavorite = val === 'true'
          break
        case 'updated_at':
        case 'updatedAt':
          diary.updatedAt = new Date(val)
          break
        case 'createdAt':
          diary.createdAt = new Date(val)
          break
        case 'mediaPaths': {
          try {
            diary.mediaPaths = JSON.parse(val)
          } catch {}
          break
        }
      }
    }

    return diary as Diary
  }
}
