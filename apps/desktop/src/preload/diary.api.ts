import { ipcRenderer } from 'electron'

export const diaryApi = {
  diary: {
    create: (input: any) => ipcRenderer.invoke('diary:create', input),
    update: (id: number, input: any) => ipcRenderer.invoke('diary:update', id, input),
    save: (id: number | null, input: any) => ipcRenderer.invoke('diary:save', id, input),
    delete: (id: number) => ipcRenderer.invoke('diary:delete', id),
    findById: (id: number) => ipcRenderer.invoke('diary:findById', id),
    findByDate: (dateStr: string) => ipcRenderer.invoke('diary:findByDate', dateStr),
    listAll: (options?: any) => ipcRenderer.invoke('diary:listAll', options),
    listFiltered: (filter?: any) => ipcRenderer.invoke('diary:listFiltered', filter),
    countFiltered: (filter?: any) => ipcRenderer.invoke('diary:countFiltered', filter),
    search: (query: string, options?: any) => ipcRenderer.invoke('diary:search', query, options),
    count: () => ipcRenderer.invoke('diary:count'),
    onSyncEvent: (callback: (event: any) => void) => {
      const handler = (_: any, event: any) => callback(event)
      ipcRenderer.on('diary:sync-event', handler)
      return () => ipcRenderer.off('diary:sync-event', handler)
    },
    // 日记附件相关API
    uploadAttachments: (args: {
      date: string
      attachments: Array<{ filePath?: string; fileName?: string; data?: string; mimeType?: string }>
    }) => ipcRenderer.invoke('diary:upload-attachments', args),
    listAttachments: (dateStr: string) => ipcRenderer.invoke('diary:list-attachments', dateStr),
    deleteAttachment: (filePath: string) => ipcRenderer.invoke('diary:delete-attachment', filePath),
    openAttachmentFolder: (filePath: string) =>
      ipcRenderer.invoke('diary:open-attachment-folder', filePath),
    copyAttachment: (filePath: string) => ipcRenderer.invoke('diary:copy-attachment', filePath),
    getAttachmentDir: (dateStr: string) => ipcRenderer.invoke('diary:get-attachment-dir', dateStr)
  },

  attachment: {
    listAll: () => ipcRenderer.invoke('attachment:listAll'),
    deleteBatch: (ids: string[]) => ipcRenderer.invoke('attachment:deleteBatch', ids),
    openInFolder: (absolutePath: string) =>
      ipcRenderer.invoke('attachment:openInFolder', absolutePath),
    openFile: (absolutePath: string) => ipcRenderer.invoke('attachment:openFile', absolutePath),
    deleteFile: (sessionId: string, fileName: string) =>
      ipcRenderer.invoke('attachment:deleteFile', sessionId, fileName),
    listDiaryAttachments: () => ipcRenderer.invoke('attachment:listDiaryAttachments'),
    deleteDiaryAttachment: (filePath: string) =>
      ipcRenderer.invoke('attachment:deleteDiaryAttachment', filePath),
    getThumbnail: (filePath: string, maxSize?: number) =>
      ipcRenderer.invoke('attachment:getThumbnail', filePath, maxSize),
    getFullImage: (filePath: string) => ipcRenderer.invoke('attachment:getFullImage', filePath)
  }
}
