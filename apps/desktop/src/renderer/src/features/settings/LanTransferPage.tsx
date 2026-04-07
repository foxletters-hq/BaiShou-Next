import React from 'react';
import { LanSyncCard } from '@baishou/ui';

export const LanTransferPage: React.FC = () => {
  return (
    <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, padding: 0 }}>
        <LanSyncCard 
          onStartBroadcasting={async () => (window as any).api?.lan?.startBroadcasting()}
          onStopBroadcasting={async () => (window as any).api?.lan?.stopBroadcasting()}
          onStartDiscovery={async (onFound: any, onLost: any) => {
            (window as any).api?.lan?.onDeviceFound(onFound);
            (window as any).api?.lan?.onDeviceLost(onLost);
            await (window as any).api?.lan?.startDiscovery();
          }}
          onStopDiscovery={async () => (window as any).api?.lan?.stopDiscovery()}
          onSendFile={async (ip: string, port: number, progress: any) => {
            (window as any).api?.lan?.onSendProgress(progress);
            return await (window as any).api?.lan?.sendFile(ip, port);
          }}
          onFileReceivedListener={(cb: any) => (window as any).api?.lan?.onFileReceived(cb)}
          onImportZip={async (file: string) => {(window as any).api?.archive.importZip(file)}}
        />
      </div>
    </div>
  );
};
