import React, { useState } from 'react';
import styles from './WorkspaceSettingsCard.module.css';
import { useTranslation } from 'react-i18next';


// Reuse type from core if available, but define locally to keep ui package independent
export interface VaultInfo {
  name: string;
  path: string;
  createdAt: Date | string;
  lastAccessedAt: Date | string;
}

export interface WorkspaceSettingsCardProps {
  vaults: VaultInfo[];
  activeVault: VaultInfo | null;
  onSwitch: (name: string) => void;
  onDelete: (name: string) => void;
  onCreate: (name: string) => Promise<void>;
  customRootPath?: string | null;
  onPickCustomRoot?: () => Promise<string | null>;
}

export const WorkspaceSettingsCard: React.FC<WorkspaceSettingsCardProps> = ({
  vaults,
  activeVault,
  onSwitch,
  onDelete,
  onCreate,
  customRootPath,
  onPickCustomRoot
}) => {
  const { t } = useTranslation();
  const [newVaultName, setNewVaultName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [currentRoot, setCurrentRoot] = useState<string | null>(customRootPath || null);

  const handleCreate = async () => {
    if (!newVaultName.trim()) return;
    try {
      await onCreate(newVaultName.trim());
      setNewVaultName('');
      setIsCreating(false);
    } catch (e) {
      console.error(e);
      alert('Failed to create workspace');
    }
  };

  const handlePickRoot = async () => {
    if (!onPickCustomRoot) return;
    try {
      const newPath = await onPickCustomRoot();
      if (newPath) {
        setCurrentRoot(newPath);
      }
    } catch (e) {
      console.error('Pick root failed', e);
    }
  };

  return (
    <div className={styles.container}>
      {onPickCustomRoot && (
        <div className={styles.rootConfig}>
          <div className={styles.rootInfo}>
            <span className={styles.rootLabel}>Storage Root (Advanced):</span>
            <span className={styles.rootPath}>{currentRoot || 'Default AppData'}</span>
          </div>
          <button className={styles.switchBtn} onClick={handlePickRoot}>
            Change Root...
          </button>
        </div>
      )}

      <div className={styles.header}>
        <h3 className={styles.title}>Workspace (Vault) Settings</h3>
        <p className={styles.subtitle}>
          Each workspace is an isolated sandbox with its own database, embeddings, and settings.
        </p>
      </div>

      <div className={styles.vaultList}>
        {vaults.map(vault => {
          const isActive = activeVault?.name === vault.name;
          return (
            <div key={vault.name} className={`${styles.vaultItem} ${isActive ? styles.active : ''}`}>
              <div className={styles.vaultInfo}>
                <div className={styles.vaultName}>
                  {vault.name} {isActive && <span className={styles.activeBadge}>Active</span>}
                </div>
                <div className={styles.vaultPath}>{vault.path}</div>
              </div>
              <div className={styles.vaultActions}>
                {!isActive && (
                  <>
                    <button className={styles.switchBtn} onClick={() => onSwitch(vault.name)}>
                      Switch
                    </button>
                    <button className={styles.deleteBtn} onClick={() => {
                      const input = window.prompt(
                        t('workspace.delete_confirm', '危险：您确定要彻底删除工作空间 [{{name}}] 吗？\n此操作将销毁该空间下的所有日志记录和关联档案，不可逆！\n\n请输入工作区名称以确认删除：', { name: vault.name })
                      );
                      if (input === vault.name) {
                        onDelete(vault.name);
                      } else if (input !== null) {
                        alert('工作空间名称不匹配，删除已取消。');
                      }
                    }}>
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className={styles.createAction}>
        {isCreating ? (
          <div className={styles.createForm}>
            <input
              className={styles.input}
              value={newVaultName}
              onChange={e => setNewVaultName(e.target.value)}
              placeholder="New workspace name"
              autoFocus
            />
            <button className={styles.saveBtn} onClick={handleCreate} disabled={!newVaultName.trim()}>
              Create
            </button>
            <button className={styles.cancelBtn} onClick={() => setIsCreating(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <button className={styles.createBtn} onClick={() => setIsCreating(true)}>
            + Create New Workspace
          </button>
        )}
      </div>
    </div>
  );
};
