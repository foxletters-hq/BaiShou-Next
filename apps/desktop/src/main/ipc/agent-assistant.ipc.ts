import { ipcMain } from 'electron'
import { getAgentManagers } from './agent-helpers'

export function registerAssistantIPC() {
  // ==========================================
  // API: Assistants
  // ==========================================
  ipcMain.handle('agent:get-assistants', async () => {
    const { assistantManager } = getAgentManagers();
    return await assistantManager.findAll();
  });

  ipcMain.handle('agent:create-assistant', async (_, input) => {
    const { assistantManager } = getAgentManagers();
    
    // Safety fallback: if frontend didn't assign an ID for creation, auto-generate one
    if (!input.id) {
      input.id = `ast-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    }
    
    await assistantManager.create(input);
  });

  ipcMain.handle('agent:update-assistant', async (_, id, input) => {
    const { assistantManager } = getAgentManagers();
    await assistantManager.update(id, input);
  });

  ipcMain.handle('agent:delete-assistant', async (_, id) => {
    const { assistantManager } = getAgentManagers();
    await assistantManager.delete(id);
  });

  ipcMain.handle('agent:pin-assistant', async (_, id: string, isPinned: boolean) => {
    const { assistantManager } = getAgentManagers();
    await assistantManager.togglePin(id, isPinned);
  });
}
