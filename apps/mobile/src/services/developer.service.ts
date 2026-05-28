import * as SQLite from 'expo-sqlite'
import { deleteAsync } from './mobile-sandbox-fs'
import { getAppDocumentDirectory } from './mobile-app-paths'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { DiaryService, VaultService } from '@baishou/core-mobile'
import type { IFileSystem } from '@baishou/core-mobile'
import type { SessionManagerService, AssistantManagerService } from '@baishou/core-mobile'
import { logger } from '@baishou/shared'
import { INITIAL_DIARIES, type DemoDiaryEntry } from './demo-data'
import type { MobileStoragePathService } from './path.service'

const MOBILE_DB_NAME = 'baishou_next_mobile.db'

export interface MobileDeveloperServiceDeps {
  diaryService: DiaryService
  pathService: MobileStoragePathService
  fileSystem: IFileSystem
  vaultService: VaultService
  sessionManager?: SessionManagerService
  assistantManager?: AssistantManagerService
}

export type ClearDataResult = {
  success: boolean
  needsRestart?: boolean
  message?: string
}

export class MobileDeveloperService {
  async loadDemoData(diaryService: DiaryService): Promise<boolean> {
    const now = new Date()

    for (const demo of INITIAL_DIARIES) {
      const entryDate = this.resolveDemoDate(demo, now)
      const existing = await diaryService.findByDate(entryDate)

      if (existing) {
        await diaryService.update(existing.id!, {
          content: existing.content + '\n\n---\n\n' + demo.content,
          tags: Array.from(new Set([...(existing.tags || []), ...(demo.tags || [])])).join(','),
          mood: demo.mood || existing.mood
        })
      } else {
        await diaryService.create({
          date: entryDate,
          content: demo.content,
          tags: (demo.tags || []).join(','),
          mood: demo.mood
        })
      }
    }

    return true
  }

  async clearAllData(deps: MobileDeveloperServiceDeps): Promise<ClearDataResult> {
    try {
      const rootPath = await deps.pathService.getRootDirectory()
      if (await deps.fileSystem.exists(rootPath)) {
        const entries = await deps.fileSystem.readdir(rootPath)
        for (const name of entries) {
          await deps.fileSystem.rm(`${rootPath}/${name}`, { recursive: true, force: true })
        }
      }

      const registryDir = await deps.pathService.getGlobalRegistryDirectory()
      if (await deps.fileSystem.exists(registryDir)) {
        await deps.fileSystem.rm(registryDir, { recursive: true, force: true })
      }

      try {
        await SQLite.deleteDatabaseAsync(MOBILE_DB_NAME)
      } catch (e) {
        logger.warn('[Developer] deleteDatabase failed:', e as Error)
      }

      const docDir = getAppDocumentDirectory()
      const dbUri = `${docDir}SQLite/${MOBILE_DB_NAME}`
      try {
        await deleteAsync(dbUri, { idempotent: true })
      } catch {
        // ignore
      }

      const keys = await AsyncStorage.getAllKeys()
      const baishouKeys = keys.filter((k) => k.includes('baishou') || k.startsWith('@baishou/'))
      if (baishouKeys.length > 0) {
        await AsyncStorage.multiRemove(baishouKeys)
      }

      await deps.vaultService.initRegistry()

      return {
        success: true,
        needsRestart: true,
        message: '已清空本地数据。请完全退出并重新打开应用以重建数据库。'
      }
    } catch (e: any) {
      logger.error('[Developer] clearAllData failed:', e)
      return { success: false, message: e?.message || String(e) }
    }
  }

  async clearAgentData(deps: MobileDeveloperServiceDeps): Promise<ClearDataResult> {
    try {
      const sessionsDir = await deps.pathService.getSessionsBaseDirectory()
      const assistantsDir = await deps.pathService.getAssistantsBaseDirectory()

      await this.clearDirectory(deps.fileSystem, sessionsDir)
      await this.clearDirectory(deps.fileSystem, assistantsDir)

      if (deps.sessionManager) {
        await deps.sessionManager.fullResyncFromDisks()
      }
      if (deps.assistantManager) {
        await deps.assistantManager.fullResyncFromDisks()
      }

      return { success: true, message: '已清除 Agent 会话与助手数据。' }
    } catch (e: any) {
      logger.error('[Developer] clearAgentData failed:', e)
      return { success: false, message: e?.message || String(e) }
    }
  }

  private resolveDemoDate(demo: DemoDiaryEntry, now: Date): Date {
    if (demo.dateFixed) {
      return new Date(demo.dateFixed)
    }
    const entryDate = new Date(now.getTime())
    if (demo.dateDaysOffset) {
      entryDate.setDate(entryDate.getDate() + demo.dateDaysOffset)
    }
    if (demo.dateMinutesOffset) {
      entryDate.setMinutes(entryDate.getMinutes() + demo.dateMinutesOffset)
    }
    return entryDate
  }

  private async clearDirectory(fileSystem: IFileSystem, dirPath: string): Promise<void> {
    if (!(await fileSystem.exists(dirPath))) return
    const entries = await fileSystem.readdir(dirPath)
    for (const name of entries) {
      await fileSystem.rm(`${dirPath}/${name}`, { recursive: true, force: true })
    }
  }
}

export const mobileDeveloperService = new MobileDeveloperService()
