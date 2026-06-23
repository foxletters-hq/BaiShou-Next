import type { IFileSystem } from '../fs'
import * as path from '../fs/path.util'
import { IStoragePathService } from './storage-path.types'
import { SummaryType, formatLocalDate } from '@baishou/shared'
import {
  findExistingSummaryFileInTypeDir,
  listMarkdownInSummaryTypeDir,
  resolveSummaryFileInTypeDir,
  summaryTypeSupportsYearSubdir
} from '../summary/summary-files.util'

export class SummaryFileService {
  constructor(
    private readonly pathProvider: IStoragePathService,
    private readonly fileSystem: IFileSystem
  ) {}

  private async getCategoryDir(type: SummaryType): Promise<string> {
    const base = await this.pathProvider.getSummariesBaseDirectory()
    const typeDirName = type.charAt(0).toUpperCase() + type.slice(1)
    const targetDir = path.join(base, typeDirName)
    await this.fileSystem.mkdir(targetDir, { recursive: true })
    return targetDir
  }

  /**
   * 按白守规范格式化 Summary 文件名。例如：
   * Weekly: 2026-W12.md
   * Monthly: 2026-03.md
   */
  /**
   * 按白守规范格式化 Summary 文件名。
   * 新写入一律使用并延续老版本的格式，即：yyyy-MM-dd.md（其中日期为 startDate）
   */
  private buildFileName(_type: SummaryType, startDate: Date): string {
    const year = startDate.getFullYear().toString()
    const month = (startDate.getMonth() + 1).toString().padStart(2, '0')
    const day = startDate.getDate().toString().padStart(2, '0')
    return `${year}-${month}-${day}.md`
  }

  /**
   * 获取过渡时期（曾引入 W/Q 标识）的临时文件名，用于只读与清理兼容
   */
  private buildTransitionFileName(type: SummaryType, startDate: Date): string {
    const year = startDate.getFullYear().toString()
    const month = (startDate.getMonth() + 1).toString().padStart(2, '0')

    switch (type) {
      case SummaryType.monthly:
        return `${year}-${month}.md`
      case SummaryType.yearly:
        return `${year}.md`
      case SummaryType.quarterly: {
        const quarter = Math.floor(startDate.getMonth() / 3) + 1
        return `${year}-Q${quarter}.md`
      }
      case SummaryType.weekly: {
        // ISO 周数算法：以周四所在周为锄点（纯数学计算，募时区int）
        const d = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())
        const dayNum = d.getDay() || 7
        d.setDate(d.getDate() + 4 - dayNum)
        const yearStart = new Date(d.getFullYear(), 0, 1)
        const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
        return `${d.getFullYear()}-W${weekNo.toString().padStart(2, '0')}.md`
      }
      default:
        return `${formatLocalDate(startDate)}.md`
    }
  }

  async writeSummary(type: SummaryType, startDate: Date, content: string): Promise<string> {
    const dir = await this.getCategoryDir(type)
    const fileName = this.buildFileName(type, startDate)
    const fullPath = await resolveSummaryFileInTypeDir(this.fileSystem, dir, fileName, {
      type,
      preferYearSubdir: summaryTypeSupportsYearSubdir(type)
    })

    const parentDir = path.dirname(fullPath)
    if (!(await this.fileSystem.exists(parentDir))) {
      await this.fileSystem.mkdir(parentDir, { recursive: true })
    }

    await this.fileSystem.writeFile(fullPath, content.trim(), 'utf8')
    return fullPath
  }

  private async readSummaryFileAt(typeDir: string, fileName: string): Promise<string | null> {
    const fullPath = await findExistingSummaryFileInTypeDir(
      this.fileSystem,
      typeDir,
      fileName
    )
    if (!fullPath) return null
    try {
      const content = await this.fileSystem.readFile(fullPath, 'utf8')
      return this.cleanMarkdownContent(content)
    } catch (e: any) {
      if (e.code === 'ENOENT') return null
      throw e
    }
  }

  async readSummary(type: SummaryType, startDate: Date): Promise<string | null> {
    const base = await this.pathProvider.getSummariesBaseDirectory()
    const legacyBase = await this.pathProvider.getLegacyArchivesDirectory()
    const activeDir = await this.pathProvider.getActiveVaultPath()

    const typeDirName = type.charAt(0).toUpperCase() + type.slice(1)
    const standardFileName = this.buildFileName(type, startDate)
    const transitionFileName = this.buildTransitionFileName(type, startDate)

    // 收集所有要搜索的目录，去重且保持顺序
    const searchDirs = new Set<string>()
    searchDirs.add(base)
    if (activeDir) {
      searchDirs.add(path.join(activeDir, 'Summaries'))
    }
    if (legacyBase) {
      searchDirs.add(legacyBase)
    }

    // 优先尝试读取标准格式文件名
    for (const baseDir of searchDirs) {
      const typeDir = path.join(baseDir, typeDirName)
      const content = await this.readSummaryFileAt(typeDir, standardFileName)
      if (content != null) return content
    }

    // 如果标准格式没有找到，再尝试读取过渡期文件名（若不同）
    if (standardFileName !== transitionFileName) {
      for (const baseDir of searchDirs) {
        const typeDir = path.join(baseDir, typeDirName)
        const content = await this.readSummaryFileAt(typeDir, transitionFileName)
        if (content != null) return content
      }
    }

    return null
  }

  private cleanMarkdownContent(rawContent: string): string {
    const cleanContent = rawContent.startsWith('\uFEFF') ? rawContent.substring(1) : rawContent
    // 剥离 YAML Frontmatter
    const match = cleanContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)
    if (match && match[2]) {
      return match[2].trim()
    }
    return cleanContent.trim()
  }

  async deleteSummary(type: SummaryType, startDate: Date): Promise<void> {
    const base = await this.pathProvider.getSummariesBaseDirectory()
    const legacyBase = await this.pathProvider.getLegacyArchivesDirectory()
    const activeDir = await this.pathProvider.getActiveVaultPath()

    const typeDirName = type.charAt(0).toUpperCase() + type.slice(1)
    const standardFileName = this.buildFileName(type, startDate)
    const transitionFileName = this.buildTransitionFileName(type, startDate)

    // 收集所有要清理的目录，去重且保持顺序
    const searchDirs = new Set<string>()
    searchDirs.add(base)
    if (activeDir) {
      searchDirs.add(path.join(activeDir, 'Summaries'))
    }
    if (legacyBase) {
      searchDirs.add(legacyBase)
    }

    for (const baseDir of searchDirs) {
      const typeDir = path.join(baseDir, typeDirName)
      for (const fileName of [standardFileName, transitionFileName]) {
        const existing = await findExistingSummaryFileInTypeDir(
          this.fileSystem,
          typeDir,
          fileName
        )
        if (!existing) continue
        try {
          await this.fileSystem.unlink(existing)
        } catch (e: any) {
          if (e.code !== 'ENOENT') throw e
        }
      }
    }
  }

  async listAllSummaries(): Promise<
    { type: SummaryType; startDate: Date; endDate: Date; fullPath: string }[]
  > {
    const results: {
      type: SummaryType
      startDate: Date
      endDate: Date
      fullPath: string
    }[] = []
    const base = await this.pathProvider.getSummariesBaseDirectory()
    const legacyBase = await this.pathProvider.getLegacyArchivesDirectory()
    const activeDir = await this.pathProvider.getActiveVaultPath()

    // 收集所有要扫描的目录
    const searchDirs = new Set<string>()
    searchDirs.add(base)
    if (activeDir) {
      searchDirs.add(path.join(activeDir, 'Summaries'))
    }
    if (legacyBase) {
      searchDirs.add(legacyBase)
    }

    for (const baseDir of searchDirs) {
      await this.scanSummaryDir(baseDir, results)
    }

    return results
  }

  private async scanSummaryDir(
    baseDir: string,
    results: {
      type: SummaryType
      startDate: Date
      endDate: Date
      fullPath: string
    }[]
  ): Promise<void> {
    for (const type of Object.values(SummaryType)) {
      const typeDirName = type.charAt(0).toUpperCase() + type.slice(1)
      const typeDir = path.join(baseDir, typeDirName)
      let files: { fileName: string; fullPath: string }[] = []
      try {
        files = await listMarkdownInSummaryTypeDir(this.fileSystem, typeDir)
      } catch (e: any) {
        if (e.code !== 'ENOENT') throw e
        continue
      }
      for (const { fileName: file, fullPath } of files) {
        const dates = this.parseFileNameToDateRange(type as SummaryType, file)
        if (dates) {
          // 同一 startDate 的文件去重逻辑
          const existingIndex = results.findIndex(
            (r) => r.type === type && r.startDate.getTime() === dates.startDate.getTime()
          )
          if (existingIndex === -1) {
            results.push({
              type: type as SummaryType,
              startDate: dates.startDate,
              endDate: dates.endDate,
              fullPath
            })
          } else {
            const existingItem = results[existingIndex]
            if (existingItem) {
              const existingFile = path.basename(existingItem.fullPath)
              const existingParts = existingFile.replace('.md', '').split('-')
              const currentParts = file.replace('.md', '').split('-')
              // 如果已存在的是过渡期新格式（parts.length < 3），而当前扫描到的是标准老格式（parts.length === 3），
              // 则用标准格式覆盖替换原有的过渡格式记录，保留老版本的标准命名规范
              if (existingParts.length < 3 && currentParts.length === 3) {
                results[existingIndex] = {
                  type: type as SummaryType,
                  startDate: dates.startDate,
                  endDate: dates.endDate,
                  fullPath
                }
              }
            }
          }
        }
      }
    }
  }

  parseFileNameToDateRange(
    type: SummaryType,
    fileName: string
  ): { startDate: Date; endDate: Date } | null {
    const name = fileName.replace('.md', '')
    const parts = name.split('-')
    const year = parseInt(parts[0] ?? '', 10)
    if (isNaN(year)) return null

    // 兼容老版本 yyyy-MM-dd 格式
    if (parts.length === 3) {
      const month = parseInt(parts[1] ?? '', 10) - 1
      const day = parseInt(parts[2] ?? '', 10)
      if (isNaN(month) || isNaN(day)) return null

      const start = new Date(year, month, day, 0, 0, 0)

      switch (type) {
        case SummaryType.yearly:
          return {
            startDate: new Date(year, 0, 1),
            endDate: new Date(year, 11, 31, 23, 59, 59)
          }
        case SummaryType.monthly:
          return {
            startDate: new Date(year, month, 1),
            endDate: new Date(year, month + 1, 0, 23, 59, 59)
          }
        case SummaryType.quarterly:
          return {
            startDate: new Date(year, month, 1),
            endDate: new Date(year, month + 3, 0, 23, 59, 59)
          }
        case SummaryType.weekly: {
          const end = new Date(start.getTime() + 6 * 86400000 + 23 * 3600000 + 59 * 60000 + 59000)
          return { startDate: start, endDate: end }
        }
        default:
          return null
      }
    }

    // 新版本格式解析
    if (type === SummaryType.yearly && parts.length === 1) {
      // 全年：1.1 — 12.31
      return {
        startDate: new Date(year, 0, 1),
        endDate: new Date(year, 11, 31, 23, 59, 59)
      }
    }
    if (type === SummaryType.monthly && parts.length === 2) {
      const month = parseInt(parts[1] ?? '', 10) - 1
      return {
        startDate: new Date(year, month, 1),
        endDate: new Date(year, month + 1, 0, 23, 59, 59)
      }
    }
    if (type === SummaryType.quarterly && parts.length === 2 && (parts[1] || '').startsWith('Q')) {
      const q = parseInt((parts[1] ?? '').substring(1), 10)
      const startMonth = (q - 1) * 3
      return {
        startDate: new Date(year, startMonth, 1),
        endDate: new Date(year, startMonth + 3, 0, 23, 59, 59)
      }
    }
    if (type === SummaryType.weekly && parts.length === 2 && (parts[1] || '').startsWith('W')) {
      const week = parseInt((parts[1] ?? '').substring(1), 10)
      // 以 ISO 周界定周一和周日（本地时区）
      const simpleDate = new Date(year, 0, 4 + (week - 1) * 7)
      const dayOfWeek = simpleDate.getDay()
      const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1
      const start = new Date(
        simpleDate.getFullYear(),
        simpleDate.getMonth(),
        simpleDate.getDate() - diff,
        0,
        0,
        0
      )
      const end = new Date(start.getTime() + 6 * 86400000 + 23 * 3600000 + 59 * 60000 + 59000)
      return { startDate: start, endDate: end }
    }
    return null
  }
}
