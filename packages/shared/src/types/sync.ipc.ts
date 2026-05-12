export interface CloudSyncRecord {
  filename: string;
  lastModified: Date | string;
  sizeInBytes: number;
}

export interface MdnsServiceInfo {
  name: string;
  type: string;
  port: number;
  attributes: Record<string, string>;
  host?: string; // 经过发现后解析出的确切主机地址
}

export interface LanTransferState {
  isBroadcasting: boolean;
  isDiscovering: boolean;
  discoveredServices: MdnsServiceInfo[];
  serverIp: string | null;
  serverPort: number | null;
  error: string | null;
  // 近场收到的压缩包绝对路径提示（如果有的话）
  lastReceivedFile: string | null; 
  receivedFileToImport: string | null; 
}

export enum SyncIpcChannels {
  // Lan Transfer (Radar)
  LAN_START_BROADCASTING = 'lan:startBroadcasting',
  LAN_STOP_BROADCASTING = 'lan:stopBroadcasting',
  LAN_START_DISCOVERY = 'lan:startDiscovery',
  LAN_STOP_DISCOVERY = 'lan:stopDiscovery',
  LAN_SEND_FILE = 'lan:sendFile',
  
  // Cloud Sync
  CLOUD_SYNC_NOW = 'cloud:syncNow',
  CLOUD_LIST_RECORDS = 'cloud:listRecords',
  CLOUD_RESTORE = 'cloud:restore',
  CLOUD_DOWNLOAD_RECORD = 'cloud:downloadRecord',
  CLOUD_DELETE_RECORD = 'cloud:deleteRecord',
  CLOUD_BATCH_DELETE = 'cloud:batchDelete',
  // 增量同步
  INCREMENTAL_SYNC_GET_CONFIG = 'incrementalSync:getConfig',
  INCREMENTAL_SYNC_UPDATE_CONFIG = 'incrementalSync:updateConfig',
  INCREMENTAL_SYNC_TEST_CONNECTION = 'incrementalSync:testConnection',
  INCREMENTAL_SYNC_NOW = 'incrementalSync:sync',
  INCREMENTAL_SYNC_UPLOAD_ONLY = 'incrementalSync:uploadOnly',
  INCREMENTAL_SYNC_DOWNLOAD_ONLY = 'incrementalSync:downloadOnly',
  INCREMENTAL_SYNC_GET_LOCAL_MANIFEST = 'incrementalSync:getLocalManifest',
  INCREMENTAL_SYNC_GET_REMOTE_MANIFEST = 'incrementalSync:getRemoteManifest',
  INCREMENTAL_SYNC_REFRESH_MANIFEST = 'incrementalSync:refreshLocalManifest',
  INCREMENTAL_SYNC_GET_CONFLICTS = 'incrementalSync:getLastSyncConflicts',
  
  // Git 版本控制
  GIT_INIT = 'git:init',
  GIT_IS_INITIALIZED = 'git:isInitialized',
  GIT_GET_CONFIG = 'git:getConfig',
  GIT_UPDATE_CONFIG = 'git:updateConfig',
  GIT_TEST_REMOTE = 'git:testRemote',
  GIT_AUTO_COMMIT = 'git:autoCommit',
  GIT_COMMIT = 'git:commit',
  GIT_GET_HISTORY = 'git:getHistory',
  GIT_GET_COMMIT_CHANGES = 'git:getCommitChanges',
  GIT_GET_FILE_DIFF = 'git:getFileDiff',
  GIT_ROLLBACK_FILE = 'git:rollbackFile',
  GIT_PUSH = 'git:push',
  GIT_PULL = 'git:pull',
  GIT_HAS_CONFLICTS = 'git:hasConflicts',
  GIT_GET_CONFLICTS = 'git:getConflicts',
  GIT_RESOLVE_CONFLICT = 'git:resolveConflict',
}
