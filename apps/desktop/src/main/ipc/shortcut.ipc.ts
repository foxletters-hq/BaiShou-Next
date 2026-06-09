import { PromptShortcut } from '@baishou/shared'
import { PromptShortcutRepository } from '@baishou/database-desktop'
import { getAppDb } from '../db'
import { tracedIpcHandle } from './ipc-trace.util'

export function registerShortcutIPC() {
  tracedIpcHandle('shortcuts:get-all', async () => {
    const repo = new PromptShortcutRepository(getAppDb())
    return await repo.getShortcuts()
  })

  tracedIpcHandle('shortcuts:save-all', async (_, list: PromptShortcut[]) => {
    const repo = new PromptShortcutRepository(getAppDb())
    await repo.saveShortcuts(list)
    return true
  })

  tracedIpcHandle('shortcuts:add', async (_, sc: Omit<PromptShortcut, 'id'>) => {
    const repo = new PromptShortcutRepository(getAppDb())
    const list = await repo.getShortcuts()
    const newSc = { ...sc, id: Math.random().toString(36).substring(7) }
    list.push(newSc)
    await repo.saveShortcuts(list)
    return newSc
  })

  tracedIpcHandle('shortcuts:update', async (_, id: string, payload: Partial<PromptShortcut>) => {
    const repo = new PromptShortcutRepository(getAppDb())
    const list = await repo.getShortcuts()
    const index = list.findIndex((s) => s.id === id)
    if (index >= 0) {
      list[index] = { ...list[index], ...payload }
      await repo.saveShortcuts(list)
    }
  })

  tracedIpcHandle('shortcuts:delete', async (_, id: string) => {
    const repo = new PromptShortcutRepository(getAppDb())
    const list = await repo.getShortcuts()
    const filterList = list.filter((s) => s.id !== id)
    await repo.saveShortcuts(filterList)
  })
}
