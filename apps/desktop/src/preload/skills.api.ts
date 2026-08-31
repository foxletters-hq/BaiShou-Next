import { ipcRenderer } from 'electron'
import type { AgentSkill, AgentSkillWriteInput, PromptShortcut } from '@baishou/shared'

export const skillsApi = {
  list: () => ipcRenderer.invoke('skills:list') as Promise<AgentSkill[]>,
  listWorkspace: (folderRoot: string) =>
    ipcRenderer.invoke('skills:list-workspace', folderRoot) as Promise<AgentSkill[]>,
  listAsShortcuts: () =>
    ipcRenderer.invoke('skills:list-as-shortcuts') as Promise<PromptShortcut[]>,
  getRoot: () => ipcRenderer.invoke('skills:get-root') as Promise<string>,
  create: (input: AgentSkillWriteInput) =>
    ipcRenderer.invoke('skills:create', input) as Promise<AgentSkill>,
  update: (input: AgentSkillWriteInput) =>
    ipcRenderer.invoke('skills:update', input) as Promise<AgentSkill>,
  updateWorkspace: (folderRoot: string, input: AgentSkillWriteInput) =>
    ipcRenderer.invoke('skills:update-workspace', folderRoot, input) as Promise<AgentSkill>,
  remove: (name: string) => ipcRenderer.invoke('skills:remove', name) as Promise<void>,
  onChanged: (callback: () => void) => {
    const handler = () => callback()
    ipcRenderer.on('skills:changed', handler)
    return () => ipcRenderer.off('skills:changed', handler)
  }
}

/** 兼容旧调用：底层已切到磁盘 Skill */
export const shortcutsApi = {
  getShortcuts: () => ipcRenderer.invoke('shortcuts:get-all') as Promise<PromptShortcut[]>,
  saveShortcuts: (list: PromptShortcut[]) =>
    ipcRenderer.invoke('shortcuts:save-all', list) as Promise<boolean>,
  addShortcut: (shortcut: Omit<PromptShortcut, 'id'>) =>
    ipcRenderer.invoke('shortcuts:add', shortcut) as Promise<PromptShortcut>,
  updateShortcut: (id: string, payload: Partial<PromptShortcut>) =>
    ipcRenderer.invoke('shortcuts:update', id, payload) as Promise<void>,
  deleteShortcut: (id: string) => ipcRenderer.invoke('shortcuts:delete', id) as Promise<void>
}
