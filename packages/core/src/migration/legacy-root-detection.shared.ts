import { isSameStorageRoot, logger } from '@baishou/shared'
import type { IFileSystem } from '../fs/file-system.types'
import {
  displayLegacyMigrationPath,
  isFilesystemRootPath,
  isValidWorkspaceRoot,
  resolveLegacyMigrationTargetRoot
} from '../storage/workspace-root.util'
import { hasFlutterLegacyStorageMarkers, isLegacyAppRoot, isMigrationCompleted } from './legacy-migration.shared'

export const LEGACY_ROOT_MIN_CONFIDENCE_SCORE = 15

export interface LegacyRootCandidate {
  path: string
  score: number
  reasons: string[]
  hasStrongMarkers: boolean
  fromFlutterSp: boolean
}

export interface FlutterLegacyMigrationPending {
  sourceRoot: string
  targetRoot: string
  sourceDisplayPath: string
  targetDisplayPath: string
  confidenceScore: number
  detectionReason: string
}

export async function evaluateLegacyRootCandidate(
  fileSystem: IFileSystem,
  candidatePath: string,
  options?: { fromFlutterSp?: boolean }
): Promise<LegacyRootCandidate | null> {
  const trimmed = candidatePath.trim()
  if (!trimmed) return null

  const hasStrongMarkers = await hasFlutterLegacyStorageMarkers(fileSystem, trimmed)
  const isLegacy = await isLegacyAppRoot(fileSystem, trimmed)
  if (!isLegacy) return null

  const onFilesystemRoot = isFilesystemRootPath(trimmed)
  if (onFilesystemRoot && !hasStrongMarkers) {
    logger.info(
      `[LegacyRootDetection] Rejected filesystem root without strong markers: ${trimmed}`
    )
    return null
  }

  let score = 0
  const reasons: string[] = []

  if (hasStrongMarkers) {
    score += 25
    reasons.push('strong_markers')
  }

  if (options?.fromFlutterSp) {
    score += hasStrongMarkers ? 10 : 0
    reasons.push('flutter_sp_custom_root')
  }

  if (!hasStrongMarkers) {
    score += onFilesystemRoot ? 0 : 8
    if (!onFilesystemRoot) reasons.push('vault_journals')
  }

  if (!isValidWorkspaceRoot(trimmed) && !onFilesystemRoot) {
    score -= 50
    reasons.push('invalid_workspace_root')
  }

  if (options?.fromFlutterSp && !hasStrongMarkers) {
    logger.info(
      `[LegacyRootDetection] Ignored flutter custom_storage_root without on-disk markers: ${trimmed}`
    )
    return null
  }

  return {
    path: trimmed,
    score,
    reasons,
    hasStrongMarkers,
    fromFlutterSp: Boolean(options?.fromFlutterSp)
  }
}

export async function collectScoredLegacyRootCandidates(
  fileSystem: IFileSystem,
  rawCandidates: Array<{ path: string; fromFlutterSp?: boolean }>
): Promise<LegacyRootCandidate[]> {
  const results: LegacyRootCandidate[] = []
  const seen = new Set<string>()

  for (const candidate of rawCandidates) {
    const normalized = displayLegacyMigrationPath(candidate.path)
    if (seen.has(normalized)) continue
    seen.add(normalized)

    const evaluated = await evaluateLegacyRootCandidate(fileSystem, candidate.path, {
      fromFlutterSp: candidate.fromFlutterSp
    })
    if (!evaluated) continue

    if (evaluated.score >= LEGACY_ROOT_MIN_CONFIDENCE_SCORE) {
      logger.info(
        `[LegacyRootDetection] Accepted candidate ${candidate.path} score=${evaluated.score} reasons=${evaluated.reasons.join(',')}`
      )
      results.push(evaluated)
      continue
    }

    logger.info(
      `[LegacyRootDetection] Rejected low-confidence candidate ${candidate.path} score=${evaluated.score}`
    )
  }

  return results.sort((a, b) => b.score - a.score)
}

export async function detectFlutterLegacyMigrationPending(
  fileSystem: IFileSystem,
  options: {
    targetRoot: string
    installInstanceId: string
    rawCandidates: Array<{ path: string; fromFlutterSp?: boolean }>
  }
): Promise<FlutterLegacyMigrationPending | null> {
  const targetRoot = resolveLegacyMigrationTargetRoot(options.targetRoot.trim())
  if (!targetRoot) return null

  if (await isMigrationCompleted(fileSystem, targetRoot, options.installInstanceId)) {
    return null
  }

  const scored = await collectScoredLegacyRootCandidates(fileSystem, options.rawCandidates)
  const primary = scored[0]
  if (!primary) return null

  const sourceRoot = primary.path
  const migrationTarget = resolveLegacyMigrationTargetRoot(sourceRoot)

  if (isSameStorageRoot(sourceRoot, migrationTarget) && isSameStorageRoot(migrationTarget, targetRoot)) {
    return null
  }

  if (isSameStorageRoot(sourceRoot, targetRoot)) {
    return null
  }

  return {
    sourceRoot,
    targetRoot: migrationTarget,
    sourceDisplayPath: displayLegacyMigrationPath(sourceRoot),
    targetDisplayPath: displayLegacyMigrationPath(migrationTarget),
    confidenceScore: primary.score,
    detectionReason: primary.reasons.join(',')
  }
}
