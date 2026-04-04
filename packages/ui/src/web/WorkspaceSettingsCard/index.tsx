import React from 'react';
import { useTranslation } from 'react-i18next';
import { MdWorkspacesOutline, MdFolderSpecial, MdAdd, MdCheckCircle, MdExpandMore } from 'react-icons/md';
import { useDialog } from '../Dialog';
import { useToast } from '../Toast/useToast';
import '../shared/SettingsListTile.css';

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
}) => {
  const { t } = useTranslation();
  const dialog = useDialog();
  const toast = useToast();

  const handleCreate = async () => {
    const name = await dialog.prompt(t('workspace.new_name', '空间名称'), '');
    if (!name?.trim()) return;
    try {
      await onCreate(name.trim());
    } catch (e) {
      toast.showError(t('workspace.create_failed', '创建失败'));
    }
  };

  const handleDelete = async (vaultName: string) => {
    const input = await dialog.prompt(
      t('workspace.delete_confirm_input', '请输入工作区名称 "{{name}}" 以确认删除：', { name: vaultName })
    );
    if (input === vaultName) {
      onDelete(vaultName);
    } else if (input !== null) {
      toast.showError(t('workspace.delete_name_mismatch', '名称不匹配，删除已取消。'));
    }
  };

  const lastAccessed = (v: VaultInfo) => {
    if (!v.lastAccessedAt) return t('common.unknown_time', '未知时间');
    try {
      const d = typeof v.lastAccessedAt === 'string' ? new Date(v.lastAccessedAt) : v.lastAccessedAt;
      return d.toLocaleString().split('.')[0].replace('T', ' ');
    } catch {
      return t('common.unknown_time', '未知时间');
    }
  };

  return (
    <details className="settings-expansion-tile">
      <summary className="settings-expansion-summary">
        <div className="settings-list-tile-leading">
          <MdWorkspacesOutline size={24} />
        </div>
        <div className="settings-list-tile-content">
          <span className="settings-list-tile-title">{t('workspace.title', '工作空间 (Workspaces)')}</span>
          <span className="settings-list-tile-subtitle">
            {t('workspace.current', '当前空间: {{name}}', { name: activeVault?.name ?? '未知' })}
          </span>
        </div>
        <MdExpandMore className="settings-expansion-arrow" size={24} />
      </summary>

      <div className="settings-expansion-children">
        {vaults.map(vault => {
          const isActive = activeVault?.name === vault.name;
          return (
            <div key={vault.name} className="settings-list-tile settings-list-tile-noclick">
              <div className="settings-list-tile-leading">
                <MdFolderSpecial size={22} />
              </div>
              <div className="settings-list-tile-content">
                <span className="settings-list-tile-title">{vault.name}</span>
                <span className="settings-list-tile-subtitle">
                  {t('workspace.last_accessed', '上次访问: {{time}}', { time: lastAccessed(vault) })}
                </span>
              </div>
              {isActive ? (
                <MdCheckCircle size={22} style={{ color: 'var(--color-primary, #5BA8F5)', flexShrink: 0 }} />
              ) : (
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="settings-text-btn" onClick={() => onSwitch(vault.name)}>
                    {t('workspace.switch', '切换')}
                  </button>
                  <button className="settings-text-btn" style={{ color: '#ef4444' }} onClick={() => handleDelete(vault.name)}>
                    {t('workspace.delete', '删除')}
                  </button>
                </div>
              )}
            </div>
          );
        })}

        <div className="settings-list-divider" />

        {/* 创建新空间 */}
        <button className="settings-list-tile" onClick={handleCreate}>
          <div className="settings-list-tile-leading">
            <MdAdd size={22} />
          </div>
          <div className="settings-list-tile-content">
            <span className="settings-list-tile-title">{t('workspace.create_new', '创建新空间')}</span>
          </div>
        </button>
      </div>
    </details>
  );
};
