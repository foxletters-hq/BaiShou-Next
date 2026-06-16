import { ipcMain } from 'electron'
import { ensureDefaultLatteAssistant, syncDefaultLatteAssistantLocale } from '@baishou/core-desktop'
import { getAgentManagers } from './agent-helpers'

export function registerAssistantIPC() {
  // ==========================================
  // API: Assistants
  // ==========================================
  ipcMain.handle('agent:get-assistants', async () => {
    const { assistantManager } = getAgentManagers()
    return await assistantManager.findAll()
  })

  ipcMain.handle('agent:create-assistant', async (_, input) => {
    const { assistantManager } = getAgentManagers()

    // Safety fallback: if frontend didn't assign an ID for creation, auto-generate one
    if (!input.id) {
      input.id = `ast-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
    }

    await assistantManager.create(input)
  })

  ipcMain.handle('agent:update-assistant', async (_, id, input) => {
    const { assistantManager } = getAgentManagers()
    await assistantManager.update(id, input)
  })

  ipcMain.handle('agent:delete-assistant', async (_, id) => {
    const { assistantManager } = getAgentManagers()
    await assistantManager.delete(id)
  })

  ipcMain.handle('agent:pin-assistant', async (_, id: string, isPinned: boolean) => {
    const { assistantManager } = getAgentManagers()
    await assistantManager.togglePin(id, isPinned)
  })

  ipcMain.handle('agent:reorder-assistants', async (_, orderedIds: string[]) => {
    const { assistantManager } = getAgentManagers()
    await assistantManager.reorderAssistants(orderedIds)
  })

  ipcMain.handle('agent:sync-default-latte-locale', async (_, locale?: string) => {
    const { assistantManager } = getAgentManagers()
    await syncDefaultLatteAssistantLocale(assistantManager, locale)
    return true
  })

  ipcMain.handle('agent:ensure-default-latte-assistant', async (_, locale?: string) => {
    const { assistantManager } = getAgentManagers()
    await ensureDefaultLatteAssistant(assistantManager, locale)
    return true
  })
}
