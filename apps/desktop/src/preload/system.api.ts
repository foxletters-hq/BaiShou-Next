import { ipcRenderer, webFrame } from 'electron'

export const systemApi = {
  pickFiles: () => ipcRenderer.invoke('system:pick-files'),

  // Summary System
  summary: {
    save: (input: any) => ipcRenderer.invoke('summary:save', input),
    update: (id: number, type: string, startDate: string, endDate: string, update: any) =>
      ipcRenderer.invoke('summary:update', id, type, startDate, endDate, update),
    delete: (type: string, startDate: string, endDate: string) =>
      ipcRenderer.invoke('summary:delete', type, startDate, endDate),
    readDetail: (type: string, startDate: string, endDate: string) =>
      ipcRenderer.invoke('summary:readDetail', type, startDate, endDate),
    list: (options?: any) => ipcRenderer.invoke('summary:list', options),
    buildSharedContext: (lookbackMonths: number, locale?: string) =>
      ipcRenderer.invoke('summary:buildSharedContext', lookbackMonths, locale)
  },

  // Onboarding
  onboarding: {
    check: () => ipcRenderer.invoke('onboarding:check'),
    pickDirectory: () => ipcRenderer.invoke('onboarding:pick-directory'),
    setDirectory: (path: string) => ipcRenderer.invoke('onboarding:set-directory', path),
    finish: () => ipcRenderer.invoke('onboarding:finish'),
    onReady: (callback: () => void) => {
      const handler = () => callback()
      ipcRenderer.on('onboarding:ready', handler)
      return () => ipcRenderer.off('onboarding:ready', handler)
    }
  },

  // Window Controls
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    toggleMaximize: () => ipcRenderer.send('window:toggleMaximize'),
    close: () => ipcRenderer.send('window:close')
  },

  // Zoom
  zoom: {
    setFactor: (factor: number) => webFrame.setZoomFactor(factor),
    getFactor: () => webFrame.getZoomFactor()
  },

  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:open-external', url)
  },

  // Updater
  updater: {
    check: () => ipcRenderer.invoke('updater:check'),
    download: () => ipcRenderer.invoke('updater:download'),
    install: () => ipcRenderer.invoke('updater:install'),
    getVersion: () => ipcRenderer.invoke('updater:get-version'),
    setAutoCheck: (enabled: boolean) => ipcRenderer.invoke('updater:set-auto-check', enabled),
    getAutoCheck: () => ipcRenderer.invoke('updater:get-auto-check'),
    onStatusChange: (callback: (state: any) => void) => {
      const handler = (_: any, state: any) => callback(state)
      ipcRenderer.on('updater:status-change', handler)
      return () => ipcRenderer.off('updater:status-change', handler)
    },
    onDownloadProgress: (callback: (progress: number) => void) => {
      const handler = (_: any, progress: number) => callback(progress)
      ipcRenderer.on('updater:download-progress', handler)
      return () => ipcRenderer.off('updater:download-progress', handler)
    }
  }
}
