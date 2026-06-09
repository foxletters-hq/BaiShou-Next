import { ipcRenderer } from 'electron'
import type { PromptShortcut } from '@baishou/shared'

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
