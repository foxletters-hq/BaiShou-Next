import { ipcRenderer } from 'electron'

export const syncApi = {
  lan: {
    startBroadcasting: () => ipcRenderer.invoke('lan:startBroadcasting'),
    stopBroadcasting: () => ipcRenderer.invoke('lan:stopBroadcasting'),
    startDiscovery: () => ipcRenderer.invoke('lan:startDiscovery'),
    stopDiscovery: () => ipcRenderer.invoke('lan:stopDiscovery'),
    sendFile: (ip: string, port: number) => ipcRenderer.invoke('lan:sendFile', ip, port),

    // Listeners
    onDeviceFound: (callback: (device: any) => void) => {
      const handler = (_: any, device: any) => callback(device)
      ipcRenderer.on('lan:device-found', handler)
      return () => ipcRenderer.off('lan:device-found', handler)
    },
    onDeviceLost: (callback: (deviceId: string) => void) => {
      const handler = (_: any, deviceId: string) => callback(deviceId)
      ipcRenderer.on('lan:device-lost', handler)
      return () => ipcRenderer.off('lan:device-lost', handler)
    },
    onSendProgress: (callback: (progress: number) => void) => {
      const handler = (_: any, progress: number) => callback(progress)
      ipcRenderer.on('lan:send-progress', handler)
      return () => ipcRenderer.off('lan:send-progress', handler)
    },
    onFileReceived: (callback: (zipFilePath: string) => void) => {
      const handler = (_: any, path: string) => callback(path)
      ipcRenderer.on('lan:file-received', handler)
      return () => ipcRenderer.off('lan:file-received', handler)
    }
  },

  archive: {
    exportZip: () => ipcRenderer.invoke('archive:export'),
    importZip: (filePath: string) => ipcRenderer.invoke('archive:import', filePath),
    pickZip: () => ipcRenderer.invoke('archive:pick-zip'),
    listSnapshots: () => ipcRenderer.invoke('archive:list-snapshots'),
    deleteSnapshot: (filename: string) => ipcRenderer.invoke('archive:delete-snapshot', filename),
    restoreSnapshot: (filename: string) => ipcRenderer.invoke('archive:restore-snapshot', filename),
    renameSnapshot: (oldName: string, newName: string) =>
      ipcRenderer.invoke('archive:rename-snapshot', oldName, newName),
    batchDeleteSnapshots: (filenames: string[]) =>
      ipcRenderer.invoke('archive:batch-delete-snapshots', filenames)
  },

  // Git Version Control
  git: {
    init: () => ipcRenderer.invoke('git:init'),
    isInitialized: () => ipcRenderer.invoke('git:isInitialized'),
    getStatus: () => ipcRenderer.invoke('git:getStatus'),
    stageFile: (filePath: string) => ipcRenderer.invoke('git:stageFile', filePath),
    stageAll: () => ipcRenderer.invoke('git:stageAll'),
    unstageFile: (filePath: string) => ipcRenderer.invoke('git:unstageFile', filePath),
    unstageAll: () => ipcRenderer.invoke('git:unstageAll'),
    discardFile: (filePath: string) => ipcRenderer.invoke('git:discardFile', filePath),
    discardAllChanges: () => ipcRenderer.invoke('git:discardAllChanges'),
    getConfig: () => ipcRenderer.invoke('git:getConfig'),
    updateConfig: (config: any) => ipcRenderer.invoke('git:updateConfig', config),
    testRemote: () => ipcRenderer.invoke('git:testRemote'),
    commitAll: (message: string) => ipcRenderer.invoke('git:commitAll', message),
    commitStaged: (message: string) => ipcRenderer.invoke('git:commitStaged', message),
    commit: (files: string[], message: string) => ipcRenderer.invoke('git:commit', files, message),
    getHistory: (filePath?: string, limit?: number, offset?: number) =>
      ipcRenderer.invoke('git:getHistory', filePath, limit, offset),
    getRecentPulls: (limit?: number) => ipcRenderer.invoke('git:getRecentPulls', limit),
    getCommitChanges: (commitHash: string) =>
      ipcRenderer.invoke('git:getCommitChanges', commitHash),
    getFileDiff: (filePath: string, commitHash?: string) =>
      ipcRenderer.invoke('git:getFileDiff', filePath, commitHash),
    getWorkingDiff: (filePath: string, staged: boolean) =>
      ipcRenderer.invoke('git:getWorkingDiff', filePath, staged),
    rollbackFile: (filePath: string, commitHash: string) =>
      ipcRenderer.invoke('git:rollbackFile', filePath, commitHash),
    rollbackAll: (commitHash: string) => ipcRenderer.invoke('git:rollbackAll', commitHash),
    push: () => ipcRenderer.invoke('git:push'),
    pull: () => ipcRenderer.invoke('git:pull'),
    hasConflicts: () => ipcRenderer.invoke('git:hasConflicts'),
    getConflicts: () => ipcRenderer.invoke('git:getConflicts'),
    resolveConflict: (filePath: string, resolution: 'ours' | 'theirs') =>
      ipcRenderer.invoke('git:resolveConflict', filePath, resolution)
  },

  // Incremental Sync (S3)
  incrementalSync: {
    getConfig: () => ipcRenderer.invoke('incrementalSync:getConfig'),
    updateConfig: (config: any) => ipcRenderer.invoke('incrementalSync:updateConfig', config),
    testConnection: (config?: any) => ipcRenderer.invoke('incrementalSync:testConnection', config),
    sync: () => ipcRenderer.invoke('incrementalSync:sync'),
    uploadOnly: () => ipcRenderer.invoke('incrementalSync:uploadOnly'),
    downloadOnly: () => ipcRenderer.invoke('incrementalSync:downloadOnly'),
    getLocalManifest: () => ipcRenderer.invoke('incrementalSync:getLocalManifest'),
    getRemoteManifest: () => ipcRenderer.invoke('incrementalSync:getRemoteManifest'),
    refreshLocalManifest: () => ipcRenderer.invoke('incrementalSync:refreshLocalManifest'),
    getLastSyncConflicts: () => ipcRenderer.invoke('incrementalSync:getLastSyncConflicts'),
    orchestratedSync: () => ipcRenderer.invoke('incrementalSync:orchestratedSync'),
    orchestratedUploadOnly: () => ipcRenderer.invoke('incrementalSync:orchestratedUploadOnly'),
    orchestratedDownloadOnly: () => ipcRenderer.invoke('incrementalSync:orchestratedDownloadOnly'),
    getSyncHistory: (limit?: number) => ipcRenderer.invoke('incrementalSync:getSyncHistory', limit),
    getLastSyncSummary: () => ipcRenderer.invoke('incrementalSync:getLastSyncSummary'),
    onSyncProgress: (callback: (event: any) => void) => {
      const handler = (_: any, event: any) => callback(event)
      ipcRenderer.on('incrementalSync:progress', handler)
      return () => ipcRenderer.off('incrementalSync:progress', handler)
    }
  },

  cloud: {
    syncNow: (config: any) => ipcRenderer.invoke('cloud:syncNow', config),
    listRecords: (config: any) => ipcRenderer.invoke('cloud:listRecords', config),
    restore: (config: any, filename: string) =>
      ipcRenderer.invoke('cloud:restore', config, filename),
    downloadRecord: (config: any, filename: string) =>
      ipcRenderer.invoke('cloud:downloadRecord', config, filename),
    deleteRecord: (config: any, filename: string) =>
      ipcRenderer.invoke('cloud:deleteRecord', config, filename),
    batchDelete: (config: any, filenames: string[]) =>
      ipcRenderer.invoke('cloud:batchDelete', config, filenames),
    rename: (config: any, oldName: string, newName: string) =>
      ipcRenderer.invoke('cloud:rename', config, oldName, newName)
  }
}
