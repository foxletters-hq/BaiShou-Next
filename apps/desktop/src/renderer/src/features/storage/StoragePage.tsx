import React from 'react';
import { StorageSettingsCard, DataManagementCard } from '@baishou/ui';
import { useTranslation } from 'react-i18next';


export const StoragePage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="glass-panel" style={{ margin: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <h1>{t('storage.title', '物理硬盘隔离项')}</h1>
      <DataManagementCard 
        onExport={() => {
  if (typeof window !== 'undefined' && window.electron) {
            window.electron.ipcRenderer.invoke('archive:export');
          }
        }}
        onImport={async () => {
  if (typeof window !== 'undefined' && window.electron) {
            const zipPath = await window.electron.ipcRenderer.invoke('archive:pick-zip');
            if (zipPath) await window.electron.ipcRenderer.invoke('archive:import', zipPath, true);
          }
        }}
        snapshots={[]} // TODO: 从 archive:list-snapshots 获取
      />
      <StorageSettingsCard
        onRefreshStats={async () => {
  if (typeof window !== 'undefined' && window.electron) {


             return window.electron.ipcRenderer.invoke('rag:get-stats');
          }
          return { dbSize: 0, vectorCount: 0, cacheSize: 0 };
        }}
      />
    </div>
  );
};
