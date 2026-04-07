import React from 'react';
import { CloudSyncPanel } from '@baishou/ui';

export const CloudSyncPage: React.FC = () => {
  return (
    <div style={{ flex: 1, padding: 0, overflowY: 'auto' }}>
       <CloudSyncPanel
         onSyncNow={async (config: any) => (window as any).api?.cloud?.syncNow(config)}
         onListRecords={async (config: any) => (window as any).api?.cloud?.listRecords(config)}
         onRestore={async (config: any, filename: string) => (window as any).api?.cloud?.restore(config, filename)}
         onDeleteRecord={async (config: any, filename: string) => (window as any).api?.cloud?.deleteRecord(config, filename)}
         onBatchDelete={async (config: any, filenames: string[]) => (window as any).api?.cloud?.batchDelete(config, filenames)}
         onRename={async (config: any, oldName: string, newName: string) => (window as any).api?.cloud?.rename(config, oldName, newName)}
       />
    </div>
  );
};
