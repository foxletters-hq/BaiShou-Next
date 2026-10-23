import { ipcMain } from 'electron'
import * as fs from 'fs/promises'
import * as path from 'path'
import type { AgentWorkspaceDirEntry, AgentWorkspaceReadFileResult } from '@baishou/shared'
import { logger } from '@baishou/shared'
import { replaceInWorkspaceFiles, searchWorkspaceFiles } from '@baishou/core-desktop'
import {
  copyWorkspaceEntry,
  importExternalPaths,
  moveWorkspaceEntry
} from '../services/agent-workspace-fs-transfer'
import {
  MAX_READ_BYTES,
  buildRenamedWorkspaceRelativePath,
  listDirectoryEntries,
  normalizeWorkspaceRelativePath,
  resolveWithinRoot,
  stripUtf8Bom
} from './agent-workspace-fs.util'

export function registerAgentWorkspaceFilesIPC(): void {
  ipcMain.handle(
    'agent-workspace:list-dir',
    async (_event, rootPath: string, relativePath?: string): Promise<AgentWorkspaceDirEntry[]> => {
      if (!rootPath?.trim()) return []
      try {
        return await listDirectoryEntries(rootPath, relativePath)
      } catch (error) {
        logger.warn(
          '[AgentWorkspaceIPC] list-dir failed:',
          error instanceof Error ? error : String(error)
        )
        return []
      }
    }
  )

  ipcMain.handle(
    'agent-workspace:read-file',
    async (
      _event,
      rootPath: string,
      relativePath: string
    ): Promise<AgentWorkspaceReadFileResult> => {
      const filePath = resolveWithinRoot(rootPath, relativePath)
      const stat = await fs.stat(filePath)
      if (!stat.isFile()) {
        throw new Error('Not a file')
      }

      const truncated = stat.size > MAX_READ_BYTES
      const length = truncated ? MAX_READ_BYTES : stat.size
      const handle = await fs.open(filePath, 'r')
      try {
        const buffer = Buffer.alloc(length)
        await handle.read(buffer, 0, length, 0)
        return {
          content: stripUtf8Bom(buffer.toString('utf-8')),
          truncated,
          byteLength: stat.size
        }
      } finally {
        await handle.close()
      }
    }
  )

  ipcMain.handle(
    'agent-workspace:write-file',
    async (_event, rootPath: string, relativePath: string, content: string) => {
      const filePath = resolveWithinRoot(rootPath, relativePath)
      await fs.mkdir(path.dirname(filePath), { recursive: true })
      await fs.writeFile(filePath, content, 'utf-8')
      return true
    }
  )

  ipcMain.handle(
    'agent-workspace:create-file',
    async (_event, rootPath: string, relativePath: string, content = '') => {
      const normalized = normalizeWorkspaceRelativePath(relativePath)
      if (!normalized.trim()) throw new Error('Invalid file path')
      const filePath = resolveWithinRoot(rootPath, normalized)
      try {
        await fs.mkdir(path.dirname(filePath), { recursive: true })
        await fs.writeFile(filePath, content, { encoding: 'utf-8', flag: 'wx' })
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
          throw new Error('File already exists')
        }
        throw error
      }
      return { relativePath: normalized }
    }
  )

  ipcMain.handle(
    'agent-workspace:create-directory',
    async (_event, rootPath: string, relativePath: string) => {
      const normalized = normalizeWorkspaceRelativePath(relativePath, { trimTrailingSlash: true })
      if (!normalized.trim()) throw new Error('Invalid folder path')
      const dirPath = resolveWithinRoot(rootPath, normalized)
      await fs.mkdir(dirPath, { recursive: true })
      return { relativePath: normalized }
    }
  )

  ipcMain.handle(
    'agent-workspace:delete-entry',
    async (_event, rootPath: string, relativePath: string) => {
      const normalized = normalizeWorkspaceRelativePath(relativePath)
      if (!normalized.trim()) throw new Error('Cannot delete workspace root')
      const targetPath = resolveWithinRoot(rootPath, normalized)
      await fs.rm(targetPath, { recursive: true, force: true })
      return true
    }
  )

  ipcMain.handle(
    'agent-workspace:rename-entry',
    async (_event, rootPath: string, relativePath: string, nextName: string) => {
      const { normalized, nextRelative, trimmedName } = buildRenamedWorkspaceRelativePath(
        relativePath,
        nextName
      )
      if (!normalized.trim() || !trimmedName) throw new Error('Invalid rename target')
      const fromPath = resolveWithinRoot(rootPath, normalized)
      const toPath = resolveWithinRoot(rootPath, nextRelative)
      await fs.rename(fromPath, toPath)
      return { relativePath: nextRelative }
    }
  )

  ipcMain.handle(
    'agent-workspace:move-entry',
    async (_event, rootPath: string, fromRelative: string, toParentRelative: string) => {
      return moveWorkspaceEntry({
        resolveWithinRoot,
        rootPath,
        fromRelative,
        toParentRelative: toParentRelative ?? ''
      })
    }
  )

  ipcMain.handle(
    'agent-workspace:copy-entry',
    async (_event, rootPath: string, fromRelative: string, toParentRelative: string) => {
      return copyWorkspaceEntry({
        resolveWithinRoot,
        rootPath,
        fromRelative,
        toParentRelative: toParentRelative ?? ''
      })
    }
  )

  ipcMain.handle(
    'agent-workspace:import-external-paths',
    async (_event, rootPath: string, toParentRelative: string, absolutePaths: string[]) => {
      if (!Array.isArray(absolutePaths) || absolutePaths.length === 0) {
        return { imported: [] as string[] }
      }
      return importExternalPaths({
        resolveWithinRoot,
        rootPath,
        toParentRelative: toParentRelative ?? '',
        absolutePaths
      })
    }
  )

  ipcMain.handle(
    'agent-workspace:search-files',
    async (_event, rootPath: string, options: import('@baishou/shared').WorkspaceSearchOptions) => {
      if (!rootPath?.trim()) {
        return { files: [], totalMatches: 0, totalFiles: 0, truncated: false }
      }
      return searchWorkspaceFiles(path.resolve(rootPath), options ?? { pattern: '' })
    }
  )

  ipcMain.handle(
    'agent-workspace:replace-in-files',
    async (
      _event,
      rootPath: string,
      options: import('@baishou/shared').WorkspaceReplaceOptions
    ) => {
      if (!rootPath?.trim()) {
        return { filesChanged: 0, replacements: 0, errors: ['No workspace folder'] }
      }
      return replaceInWorkspaceFiles(path.resolve(rootPath), options)
    }
  )
}
