import { BrowserWindow } from 'electron'
import type { AgentSkillCatalogEntry } from './agent-skills.types'

export type CatalogCache = {
  bundledRoot: string
  userRoot: string
  bundledMtimeMs: number
  userMtimeMs: number
  entries: AgentSkillCatalogEntry[]
}

export let catalogCache: CatalogCache | null = null
/** 进程内：迁移已完成（含 DB flag 已读为 true） */
export let migrateDoneInProcess = false
/** 进程内：非官方技能已从 AI/skills 迁到 `.agents/skills` */
export let relocateDoneInProcess = false
/** 进程内：旧官方 writer 目录已删除 */
export let removeWriterDoneInProcess = false
/** 进程内：已退役官方技能已从 AI/skills 删除 */
export let removeRetiredOfficialDoneInProcess = false
/** 进程内：默认 skills 已 ensure 过（写盘后会清掉） */
export let defaultsEnsuredInProcess = false

export function setCatalogCache(next: CatalogCache | null): void {
  catalogCache = next
}

export function setMigrateDoneInProcess(value: boolean): void {
  migrateDoneInProcess = value
}

export function setRelocateDoneInProcess(value: boolean): void {
  relocateDoneInProcess = value
}

export function setRemoveWriterDoneInProcess(value: boolean): void {
  removeWriterDoneInProcess = value
}

export function setRemoveRetiredOfficialDoneInProcess(value: boolean): void {
  removeRetiredOfficialDoneInProcess = value
}

export function setDefaultsEnsuredInProcess(value: boolean): void {
  defaultsEnsuredInProcess = value
}

export function invalidateAgentSkillsCache(): void {
  catalogCache = null
}

export function broadcastSkillsChanged(): void {
  try {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.send('skills:changed')
    }
  } catch {
    // 测试环境或尚无窗口
  }
}

/** 测试专用 */
export function resetAgentSkillsCacheForTests(): void {
  catalogCache = null
  migrateDoneInProcess = false
  relocateDoneInProcess = false
  removeWriterDoneInProcess = false
  removeRetiredOfficialDoneInProcess = false
  defaultsEnsuredInProcess = false
}
