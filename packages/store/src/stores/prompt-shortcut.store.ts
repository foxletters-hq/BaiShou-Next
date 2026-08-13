import { createStore } from '../create-store'
import {
  dedupePromptShortcuts,
  findShortcutCommandConflict,
  skillToPromptShortcut,
  type AgentSkill,
  type PromptShortcut
} from '@baishou/shared'

export class DuplicateShortcutCommandError extends Error {
  constructor() {
    super('DUPLICATE_SHORTCUT_COMMAND')
    this.name = 'DuplicateShortcutCommandError'
  }
}

export class DuplicateSkillNameError extends Error {
  constructor() {
    super('DUPLICATE_SKILL_NAME')
    this.name = 'DuplicateSkillNameError'
  }
}

export interface PromptShortcutState {
  shortcuts: PromptShortcut[]
  skills: AgentSkill[]
  isLoading: boolean
}

export interface PromptShortcutActions {
  loadShortcuts: () => Promise<void>
  addShortcut: (shortcut: PromptShortcut) => Promise<void>
  updateShortcut: (shortcut: PromptShortcut) => Promise<void>
  removeShortcut: (id: string) => Promise<void>
  reorderShortcuts: (oldIndex: number, newIndex: number) => Promise<void>
}

function mapSkillsToShortcuts(skills: AgentSkill[]): PromptShortcut[] {
  return dedupePromptShortcuts(skills.map(skillToPromptShortcut))
}

export const usePromptShortcutStore = createStore<PromptShortcutState & PromptShortcutActions>(
  'PromptShortcutStore',
  (set, get: any) => ({
    shortcuts: [],
    skills: [],
    isLoading: false,

    loadShortcuts: async () => {
      set({ isLoading: true })
      try {
        const api = typeof window !== 'undefined' ? (window as any).api : null
        if (api?.skills?.list) {
          const skills = (await api.skills.list()) as AgentSkill[]
          set({ skills, shortcuts: mapSkillsToShortcuts(skills) })
        } else if (api?.shortcuts) {
          const list = await api.shortcuts.getShortcuts()
          set({ shortcuts: dedupePromptShortcuts(list), skills: [] })
        }
      } catch (e) {
        console.error('[PromptShortcutStore] Failed to load skills/shortcuts from IPC', e)
      } finally {
        set({ isLoading: false })
      }
    },

    addShortcut: async (shortcut: PromptShortcut) => {
      const state = get() as PromptShortcutState
      if (findShortcutCommandConflict(state.shortcuts, shortcut)) {
        throw new DuplicateShortcutCommandError()
      }
      const api = typeof window !== 'undefined' ? (window as any).api : null
      if (api?.skills?.create) {
        try {
          await api.skills.create({
            name: shortcut.command || shortcut.name || shortcut.id,
            description: shortcut.description || shortcut.name || shortcut.tag || '',
            content: shortcut.content
          })
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e)
          if (message.includes('DUPLICATE_SKILL_NAME')) throw new DuplicateSkillNameError()
          throw e
        }
        await (get() as PromptShortcutActions).loadShortcuts()
        return
      }
      const list = dedupePromptShortcuts([...state.shortcuts, shortcut])
      set({ shortcuts: list })
      if (api?.shortcuts) {
        await api.shortcuts.saveShortcuts(list)
      }
    },

    updateShortcut: async (shortcut: PromptShortcut) => {
      const state = get() as PromptShortcutState
      if (findShortcutCommandConflict(state.shortcuts, shortcut, shortcut.id)) {
        throw new DuplicateShortcutCommandError()
      }
      const api = typeof window !== 'undefined' ? (window as any).api : null
      if (api?.skills?.update) {
        try {
          await api.skills.update({
            previousName: shortcut.id,
            name: shortcut.command || shortcut.id,
            description: shortcut.description || shortcut.name || shortcut.tag || '',
            content: shortcut.content
          })
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e)
          if (message.includes('DUPLICATE_SKILL_NAME')) throw new DuplicateSkillNameError()
          throw e
        }
        await (get() as PromptShortcutActions).loadShortcuts()
        return
      }
      const list = dedupePromptShortcuts(
        state.shortcuts.map((e) => (e.id === shortcut.id ? shortcut : e))
      )
      set({ shortcuts: list })
      if (api?.shortcuts) {
        await api.shortcuts.saveShortcuts(list)
      }
    },

    removeShortcut: async (id: string) => {
      const api = typeof window !== 'undefined' ? (window as any).api : null
      if (api?.skills?.remove) {
        await api.skills.remove(id)
        await (get() as PromptShortcutActions).loadShortcuts()
        return
      }
      const state = get() as PromptShortcutState
      const list = state.shortcuts.filter((e) => e.id !== id)
      set({ shortcuts: list })
      if (api?.shortcuts) {
        await api.shortcuts.saveShortcuts(list)
      }
    },

    reorderShortcuts: async (oldIndex: number, newIndex: number) => {
      // 磁盘 skill 暂不支持持久化排序；仅更新本地展示顺序
      const state = get() as PromptShortcutState
      const newList = [...state.shortcuts]
      if (oldIndex < newIndex) {
        newIndex -= 1
      }
      const item = newList.splice(oldIndex, 1)[0]
      if (item) {
        newList.splice(newIndex, 0, item)
        set({ shortcuts: dedupePromptShortcuts(newList) })
      }
    }
  })
)
