import type { IFileSystem } from '../fs/file-system.types'
import * as path from '../fs/path.util'
import { parseJournalMarkdown } from '../diary/journal-markdown.parser'
import { parseDateStr } from '@baishou/shared'
import type { CreateDiaryInput } from '@baishou/shared'
import { mergeDirectories } from './legacy-migration.shared'
import {
  buildJournalFilePathFromDateStr,
  importLegacyJournalToDisk,
  legacyJournalAlreadyMigrated
} from './legacy-journal-migration.util'
import { countArchiveMarkdownUnderArchivesDir } from '../vault/archive-files.util'
import type { LegacyVersionMigrationImportResult } from './legacy-version-migration.util'
import {
  JOURNAL_DATE_FILE,
  type LegacyVersionMigrationImporterDeps
} from './legacy-version-migration.importer.types'

async function walkJournalFiles(
  fileSystem: IFileSystem,
  dir: string,
  onFile: (filePath: string, dateStr: string) => Promise<void>
): Promise<void> {
  if (!(await fileSystem.exists(dir))) return

  let entries: string[] = []
  try {
    entries = await fileSystem.readdir(dir)
  } catch {
    return
  }

  for (const name of entries) {
    const fullPath = path.join(dir, name)
    const dateMatch = JOURNAL_DATE_FILE.exec(name)
    if (dateMatch) {
      await onFile(fullPath, dateMatch[1]!)
      continue
    }
    try {
      const stat = await fileSystem.stat(fullPath)
      if (stat.isDirectory) {
        await walkJournalFiles(fileSystem, fullPath, onFile)
      }
    } catch {
      // skip
    }
  }
}

function diaryInputFromParsed(
  dateStr: string,
  parsed: ReturnType<typeof parseJournalMarkdown>
): CreateDiaryInput {
  const fallbackDate = parseDateStr(dateStr) ?? new Date()
  if (!parsed) {
    return { date: fallbackDate, content: '' }
  }
  return {
    date: parseDateStr(parsed.date) ?? fallbackDate,
    content: parsed.content,
    tags: parsed.tags.length > 0 ? parsed.tags.join(',') : undefined,
    weather: parsed.weather,
    mood: parsed.mood,
    location: parsed.location,
    locationDetail: parsed.locationDetail,
    isFavorite: parsed.isFavorite,
    mediaPaths: parsed.mediaPaths
  }
}

export async function importLegacyDiariesForVault(
  deps: LegacyVersionMigrationImporterDeps,
  legacyVaultName: string
): Promise<
  Pick<LegacyVersionMigrationImportResult, 'imported' | 'skipped' | 'failed' | 'failureSamples'>
> {
  const {
    fileSystem,
    sourceRoot,
    diaryService,
    onProgress,
    runInVaultContext,
    readTargetJournalRaw
  } = deps
  let imported = 0
  let skipped = 0
  let failed = 0
  const failureSamples: string[] = []
  const targetVaultName = await deps.resolveTargetVaultName(legacyVaultName)

  const readTargetRaw = async (dateStr: string): Promise<string | null> => {
    if (readTargetJournalRaw) {
      return readTargetJournalRaw(dateStr, targetVaultName)
    }
    const targetPath = buildJournalFilePathFromDateStr(
      path.join(deps.targetRoot, targetVaultName, 'Journals'),
      dateStr
    )
    if (!(await fileSystem.exists(targetPath))) return null
    return fileSystem.readFile(targetPath, 'utf8')
  }

  await runInVaultContext(legacyVaultName, async () => {
    const journalsBase = deps.getJournalsBaseDirectory
      ? await deps.getJournalsBaseDirectory(targetVaultName)
      : path.join(deps.targetRoot, targetVaultName, 'Journals')

    await walkJournalFiles(
      fileSystem,
      path.join(sourceRoot, legacyVaultName, 'Journals'),
      async (filePath, dateStr) => {
        onProgress?.(filePath)
        try {
          const legacyRaw = await fileSystem.readFile(filePath, 'utf8')
          const targetRaw = await readTargetRaw(dateStr)

          if (deps.getJournalsBaseDirectory) {
            const outcome = await importLegacyJournalToDisk(
              fileSystem,
              journalsBase,
              dateStr,
              legacyRaw,
              targetRaw
            )
            if (outcome === 'skipped') skipped += 1
            else imported += 1
            return
          }

          if (targetRaw != null && legacyJournalAlreadyMigrated(legacyRaw, targetRaw, dateStr)) {
            skipped += 1
            return
          }

          const parsed = parseJournalMarkdown(legacyRaw, dateStr)
          await diaryService.save(null, diaryInputFromParsed(dateStr, parsed))
          imported += 1
        } catch (error) {
          failed += 1
          if (failureSamples.length < 12) {
            const message = error instanceof Error ? error.message : String(error)
            failureSamples.push(`日记 ${dateStr}: ${message}`)
          }
        }
      }
    )
  })

  return {
    imported,
    skipped,
    failed,
    failureSamples: failureSamples.length > 0 ? failureSamples : undefined
  }
}

export async function importLegacyArchivesForVault(
  deps: LegacyVersionMigrationImporterDeps,
  legacyVaultName: string
): Promise<
  Pick<LegacyVersionMigrationImportResult, 'imported' | 'skipped' | 'failed' | 'failureSamples'>
> {
  const { fileSystem, sourceRoot, onProgress } = deps
  const sourceArchives = path.join(sourceRoot, legacyVaultName, 'Archives')
  if (!(await fileSystem.exists(sourceArchives))) {
    return { imported: 0, skipped: 0, failed: 0 }
  }

  const targetVault = await deps.resolveTargetVaultName(legacyVaultName)
  const targetArchives = path.join(deps.targetRoot, targetVault, 'Archives')
  const sourceCount = await countArchiveMarkdownUnderArchivesDir(fileSystem, sourceArchives)

  onProgress?.(sourceArchives)
  const failedPaths = await mergeDirectories(fileSystem, sourceArchives, targetArchives)
  if (failedPaths.length > 0) {
    return {
      imported: 0,
      skipped: 0,
      failed: failedPaths.length,
      failureSamples: failedPaths.slice(0, 12).map((p) => `总结 ${p}`)
    }
  }

  return {
    imported: sourceCount,
    skipped: 0,
    failed: 0
  }
}
