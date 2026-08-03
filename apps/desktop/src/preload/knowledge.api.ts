import { ipcRenderer } from 'electron'

export const knowledgeApi = {
  knowledge: {
    createNotebook: (input: { name: string; description?: string }) =>
      ipcRenderer.invoke('knowledge:create-notebook', input),
    listNotebooks: () => ipcRenderer.invoke('knowledge:list-notebooks'),
    importSource: (input: {
      notebookId: string
      title: string
      kind: 'file' | 'text'
      absolutePath?: string
      textContent?: string
      fileName?: string
    }) => ipcRenderer.invoke('knowledge:import-source', input),
    retrySource: (sourceId: string) => ipcRenderer.invoke('knowledge:retry-source', sourceId),
    rebuildIndex: (notebookId: string) =>
      ipcRenderer.invoke('knowledge:rebuild-index', notebookId),
    getStats: (notebookId?: string) => ipcRenderer.invoke('knowledge:get-stats', notebookId),
    listSources: (notebookId: string) => ipcRenderer.invoke('knowledge:list-sources', notebookId)
  }
}
