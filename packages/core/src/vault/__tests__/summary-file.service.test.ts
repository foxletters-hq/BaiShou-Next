import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { SummaryFileService } from '../summary-file.service'
import { SummaryType } from '@baishou/shared'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs/promises'

describe('SummaryFileService', () => {
  let tempDir: string
  let service: SummaryFileService
  let summariesDir: string
  let archivesDir: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'baishou-summary-test-'))
    summariesDir = path.join(tempDir, 'Summaries')
    archivesDir = path.join(tempDir, 'Archives')

    await fs.mkdir(summariesDir, { recursive: true })
    await fs.mkdir(archivesDir, { recursive: true })

    const mockPathService = {
      getSummariesBaseDirectory: vi.fn().mockResolvedValue(summariesDir),
      getLegacyArchivesDirectory: vi.fn().mockResolvedValue(archivesDir),
      getActiveVaultPath: vi.fn().mockResolvedValue(tempDir)
    }

    service = new SummaryFileService(mockPathService as any)
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => null)
  })

  describe('parseFileNameToDateRange', () => {
    it('should parse new weekly format (yyyy-Www.md)', () => {
      const range = service.parseFileNameToDateRange(SummaryType.weekly, '2026-W12.md')
      expect(range).not.toBeNull()
      expect(range?.startDate.getFullYear()).toBe(2026)
      // 2026-W12 对应的具体日期计算
      expect(range?.startDate).toBeInstanceOf(Date)
      expect(range?.endDate).toBeInstanceOf(Date)
    })

    it('should parse legacy weekly format (yyyy-MM-dd.md)', () => {
      const range = service.parseFileNameToDateRange(SummaryType.weekly, '2026-05-18.md')
      expect(range).not.toBeNull()
      expect(range?.startDate.getFullYear()).toBe(2026)
      expect(range?.startDate.getMonth()).toBe(4) // 5月是 4 (0-indexed)
      expect(range?.startDate.getDate()).toBe(18)

      // 检查 endDate (本周日)
      expect(range?.endDate.getFullYear()).toBe(2026)
      expect(range?.endDate.getMonth()).toBe(4)
      expect(range?.endDate.getDate()).toBe(24)
    })

    it('should parse legacy monthly format (yyyy-MM-dd.md)', () => {
      const range = service.parseFileNameToDateRange(SummaryType.monthly, '2026-05-01.md')
      expect(range).not.toBeNull()
      expect(range?.startDate.getFullYear()).toBe(2026)
      expect(range?.startDate.getMonth()).toBe(4)
      expect(range?.startDate.getDate()).toBe(1)

      expect(range?.endDate.getFullYear()).toBe(2026)
      expect(range?.endDate.getMonth()).toBe(4)
      expect(range?.endDate.getDate()).toBe(31)
    })

    it('should parse legacy quarterly format (yyyy-MM-dd.md)', () => {
      const range = service.parseFileNameToDateRange(SummaryType.quarterly, '2026-04-01.md')
      expect(range).not.toBeNull()
      expect(range?.startDate.getFullYear()).toBe(2026)
      expect(range?.startDate.getMonth()).toBe(3) // 4月是 3
      expect(range?.startDate.getDate()).toBe(1)

      expect(range?.endDate.getFullYear()).toBe(2026)
      expect(range?.endDate.getMonth()).toBe(5) // 6月是 5
      expect(range?.endDate.getDate()).toBe(30)
    })

    it('should parse legacy yearly format (yyyy-MM-dd.md)', () => {
      const range = service.parseFileNameToDateRange(SummaryType.yearly, '2026-01-01.md')
      expect(range).not.toBeNull()
      expect(range?.startDate.getFullYear()).toBe(2026)
      expect(range?.startDate.getMonth()).toBe(0)
      expect(range?.startDate.getDate()).toBe(1)

      expect(range?.endDate.getFullYear()).toBe(2026)
      expect(range?.endDate.getMonth()).toBe(11) // 12月是 11
      expect(range?.endDate.getDate()).toBe(31)
    })
  })

  describe('readSummary', () => {
    it('should read new format summary if it exists', async () => {
      const content = 'New format summary content'
      const startDate = new Date(2026, 4, 18) // 2026-05-18

      // 写入新版本文件
      const weeklyDir = path.join(summariesDir, 'Weekly')
      await fs.mkdir(weeklyDir, { recursive: true })

      // 2026-05-18 属于第 21 周，新版文件名为 2026-W21.md
      await fs.writeFile(path.join(weeklyDir, '2026-W21.md'), content, 'utf8')

      const result = await service.readSummary(SummaryType.weekly, startDate)
      expect(result).toBe(content)
    })

    it('should fallback to legacy archive file and strip Frontmatter if new format does not exist', async () => {
      const rawLegacyContent = `---
id: 42
type: weekly
startDate: 2026-05-18T00:00:00.000
endDate: 2026-05-24T23:59:59.000
generatedAt: 2026-05-21T12:00:00.000
sourceIds:
  - doc-1
  - doc-2
---
This is legacy markdown content.`

      const startDate = new Date(2026, 4, 18)

      // 写入旧版本 Archives 目录下的文件
      const legacyWeeklyDir = path.join(archivesDir, 'Weekly')
      await fs.mkdir(legacyWeeklyDir, { recursive: true })
      await fs.writeFile(path.join(legacyWeeklyDir, '2026-05-18.md'), rawLegacyContent, 'utf8')

      const result = await service.readSummary(SummaryType.weekly, startDate)
      expect(result).toBe('This is legacy markdown content.')
    })

    it('should return null if neither new nor legacy summary exists', async () => {
      const result = await service.readSummary(SummaryType.weekly, new Date(2026, 4, 18))
      expect(result).toBeNull()
    })
  })

  describe('writeSummary', () => {
    it('should write summary in the standard format (yyyy-MM-dd.md)', async () => {
      const content = 'Written summary content'
      const startDate = new Date(2026, 4, 18) // 2026-05-18
      const fullPath = await service.writeSummary(SummaryType.weekly, startDate, content)

      expect(path.basename(fullPath)).toBe('2026-05-18.md')
      const readContent = await fs.readFile(fullPath, 'utf8')
      expect(readContent).toBe(content)
    })
  })

  describe('deleteSummary', () => {
    it('should delete both new format and legacy format summaries', async () => {
      const startDate = new Date(2026, 4, 18)

      const weeklyDir = path.join(summariesDir, 'Weekly')
      await fs.mkdir(weeklyDir, { recursive: true })
      const newFilePath = path.join(weeklyDir, '2026-W21.md')
      await fs.writeFile(newFilePath, 'new content', 'utf8')

      const legacyWeeklyDir = path.join(archivesDir, 'Weekly')
      await fs.mkdir(legacyWeeklyDir, { recursive: true })
      const legacyFilePath = path.join(legacyWeeklyDir, '2026-05-18.md')
      await fs.writeFile(legacyFilePath, 'legacy content', 'utf8')

      // 验证写入成功
      await expect(fs.access(newFilePath)).resolves.toBeUndefined()
      await expect(fs.access(legacyFilePath)).resolves.toBeUndefined()

      // 执行删除
      await service.deleteSummary(SummaryType.weekly, startDate)

      // 验证两者都已被删除
      await expect(fs.access(newFilePath)).rejects.toThrow()
      await expect(fs.access(legacyFilePath)).rejects.toThrow()
    })
  })

  describe('SummaryFileService with shared Archives directory', () => {
    let sharedDir: string
    let sharedService: SummaryFileService

    beforeEach(async () => {
      sharedDir = path.join(tempDir, 'SharedArchives')
      await fs.mkdir(sharedDir, { recursive: true })

      const mockPathService = {
        getSummariesBaseDirectory: vi.fn().mockResolvedValue(sharedDir),
        getLegacyArchivesDirectory: vi.fn().mockResolvedValue(sharedDir),
        getActiveVaultPath: vi.fn().mockResolvedValue(tempDir)
      }

      sharedService = new SummaryFileService(mockPathService as any)
    })

    it('should read legacy format file in the shared directory and strip frontmatter', async () => {
      const rawLegacyContent = `---\ntype: weekly\n---\nShared legacy content`
      const startDate = new Date(2026, 4, 18)
      const weeklyDir = path.join(sharedDir, 'Weekly')
      await fs.mkdir(weeklyDir, { recursive: true })
      await fs.writeFile(path.join(weeklyDir, '2026-05-18.md'), rawLegacyContent, 'utf8')

      const result = await sharedService.readSummary(SummaryType.weekly, startDate)
      expect(result).toBe('Shared legacy content')
    })

    it('should delete legacy format file in the shared directory', async () => {
      const startDate = new Date(2026, 4, 18)
      const weeklyDir = path.join(sharedDir, 'Weekly')
      await fs.mkdir(weeklyDir, { recursive: true })
      const legacyPath = path.join(weeklyDir, '2026-05-18.md')
      await fs.writeFile(legacyPath, 'content', 'utf8')

      await expect(fs.access(legacyPath)).resolves.toBeUndefined()
      await sharedService.deleteSummary(SummaryType.weekly, startDate)
      await expect(fs.access(legacyPath)).rejects.toThrow()
    })

    it('should scan other formats properly without duplication when base and legacy dirs are identical', async () => {
      const weeklyDir = path.join(sharedDir, 'Weekly')
      await fs.mkdir(weeklyDir, { recursive: true })

      // 写入一个新格式和一个老格式，属于同一个日期 2026-05-18 (即 W21)
      await fs.writeFile(path.join(weeklyDir, '2026-W21.md'), 'new version', 'utf8')
      await fs.writeFile(path.join(weeklyDir, '2026-05-18.md'), 'old version', 'utf8')

      const summaries = await sharedService.listAllSummaries()
      // 因为是去重逻辑，同一 startDate/type 应该只保留一次 (标准版的优先)
      expect(summaries.length).toBe(1)
      expect(summaries[0]?.type).toBe(SummaryType.weekly)
      expect(summaries[0]?.fullPath).toContain('2026-05-18.md')
    })

    it('should scan and merge summaries from multiple directories (base, legacy Summaries, legacy Archives) with proper de-duplication and format priority', async () => {
      // 1. base 目录 (sharedDir) 下有老格式 2026-05-18.md
      const sharedWeeklyDir = path.join(sharedDir, 'Weekly')
      await fs.mkdir(sharedWeeklyDir, { recursive: true })
      await fs.writeFile(path.join(sharedWeeklyDir, '2026-05-18.md'), 'shared old', 'utf8')

      // 2. legacy Summaries 目录 (tempDir/Summaries) 下有新格式 2026-W21.md
      const legacySummariesWeeklyDir = path.join(tempDir, 'Summaries', 'Weekly')
      await fs.mkdir(legacySummariesWeeklyDir, { recursive: true })
      await fs.writeFile(
        path.join(legacySummariesWeeklyDir, '2026-W21.md'),
        'summaries new',
        'utf8'
      )

      // 3. 执行扫描
      const summaries = await sharedService.listAllSummaries()

      // 应该合并，且因为 2026-05-18.md 是标准格式，所以它会优先于过渡新格式 2026-W21.md
      expect(summaries.length).toBe(1)
      expect(summaries[0]?.type).toBe(SummaryType.weekly)
      expect(summaries[0]?.fullPath).toContain('2026-05-18.md')
    })
  })
})
