import React, { useEffect, useState } from 'react';
import { GitManagementPage as GitPage, useToast } from '@baishou/ui';
import { useTranslation } from 'react-i18next';
import type { GitSyncConfig } from '@baishou/shared';

export const GitManagementPage: React.FC = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const [config, setConfig] = useState<GitSyncConfig>({
    enabled: false,
    autoCommit: true,
    commitMessageTemplate: 'sync: {date}',
  });
  const [isInitialized, setIsInitialized] = useState(false);

  const api = (window as any).api?.git;

  useEffect(() => {
    if (!api) return;
    api.getConfig().then((c: GitSyncConfig) => {
      if (c) setConfig(c);
    }).catch(() => {});
    api.isInitialized().then((v: boolean) => setIsInitialized(v)).catch(() => {});
  }, [api]);

  const handleSaveConfig = async (partial: Partial<GitSyncConfig>) => {
    const newConfig = { ...config, ...partial };
    setConfig(newConfig);
    if (api) {
      try {
        await api.updateConfig(partial);
      } catch (e: any) {
        toast.showError(e?.message || t('common.error', '保存失败'));
      }
    }
  };

  const handleInit = async () => {
    if (!api) return { success: false, message: 'API not available' };
    try {
      const result = await api.init();
      if (result.success) setIsInitialized(true);
      return result;
    } catch (e: any) {
      return { success: false, message: e?.message };
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <GitPage
        config={config}
        onSaveConfig={handleSaveConfig}
        onInit={handleInit}
        isInitialized={isInitialized}
        onTestRemote={async () => api?.testRemote() ?? false}
        onAutoCommit={async () => api?.autoCommit() ?? { success: false, data: null }}
        onCommit={async (message) => api?.commitAll(message)}
        onGetHistory={async (filePath?, limit?, offset?) => {
          if (!api) return [];
          return api.getHistory(filePath, limit, offset) ?? [];
        }}
        onGetCommitChanges={async (hash) => api?.getCommitChanges(hash) ?? []}
        onGetFileDiff={async (filePath, hash) => api?.getFileDiff(filePath, hash) ?? { path: filePath, hunks: [] }}
        onPush={async () => api?.push() ?? { success: false, message: 'API not available' }}
        onPull={async () => api?.pull() ?? { success: false, message: 'API not available' }}
        onHasConflicts={async () => api?.hasConflicts() ?? false}
        onGetConflicts={async () => api?.getConflicts() ?? []}
        onResolveConflict={async (filePath, resolution) => api?.resolveConflict(filePath, resolution) ?? { success: false }}
        onRollbackFile={async (filePath, hash) => api?.rollbackFile(filePath, hash) ?? { success: false }}
        onToast={(msg, type) => {
          if (type === 'error') toast.showError(msg);
          else if (type === 'success') toast.showSuccess(msg);
          else toast.show(msg);
        }}
      />
    </div>
  );
};
