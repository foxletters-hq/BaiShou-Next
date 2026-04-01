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
  CLOUD_DELETE_RECORD = 'cloud:deleteRecord',
  CLOUD_BATCH_DELETE = 'cloud:batchDelete',
  CLOUD_RENAME = 'cloud:rename'
}
