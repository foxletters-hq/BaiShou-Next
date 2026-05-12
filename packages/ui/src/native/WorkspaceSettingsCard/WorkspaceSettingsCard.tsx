import React from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNativeTheme } from '../theme';
import { useNativeToast } from '../Toast';

export interface VaultInfo {
  name: string;
  path: string;
  createdAt: Date | string;
  lastAccessedAt: Date | string;
}

export interface NativeWorkspaceSettingsCardProps {
  vaults: VaultInfo[];
  activeVault: VaultInfo | null;
  onSwitch: (name: string) => void;
  onDelete: (name: string) => void;
  onCreate: (name: string) => Promise<void>;
  customRootPath?: string | null;
  onPickCustomRoot?: () => Promise<string | null>;
}

export const WorkspaceSettingsCard: React.FC<NativeWorkspaceSettingsCardProps> = ({
  vaults,
  activeVault,
  onSwitch,
  onDelete,
  onCreate,
}) => {
  const { t } = useTranslation();
  const { colors, tokens } = useNativeTheme();
  const toast = useNativeToast();

  const handleCreate = () => {
    Alert.prompt(
      t('workspace.new_name', '空间名称'),
      undefined,
      async (name) => {
        if (!name?.trim()) return;
        try {
          await onCreate(name.trim());
        } catch (e) {
          toast.showToast(t('workspace.create_failed', '创建失败'), 'error');
        }
      },
      'plain-text'
    );
  };

  const handleDelete = (vaultName: string) => {
    Alert.prompt(
      t('workspace.delete_confirm_input', '请输入工作区名称 "{{name}}" 以确认删除：').replace('{{name}}', vaultName),
      undefined,
      (input) => {
        if (input === vaultName) {
          onDelete(vaultName);
        } else if (input !== null) {
          toast.showToast(t('workspace.delete_name_mismatch', '名称不匹配，删除已取消。'), 'error');
        }
      },
      'plain-text'
    );
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
    <View style={{
      backgroundColor: colors.bgSurface,
      borderRadius: tokens.radius.lg,
      overflow: 'hidden',
    }}>
      {/* 头部 */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        padding: tokens.spacing.lg,
        gap: tokens.spacing.sm,
      }}>
        <Text style={{ fontSize: 20 }}>📂</Text>
        <View style={{ flex: 1 }}>
          <Text style={{
            fontSize: 16,
            fontWeight: '600',
            color: colors.textPrimary,
          }}>
            {t('workspace.title', '工作空间')}
          </Text>
          <Text style={{
            fontSize: 14,
            color: colors.textSecondary,
          }}>
            {t('workspace.current', '当前空间: {{name}}').replace('{{name}}', activeVault?.name ?? '未知')}
          </Text>
        </View>
      </View>

      {/* 工作区列表 */}
      {vaults.map(vault => {
        const isActive = activeVault?.name === vault.name;
        return (
          <View
            key={vault.name}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              padding: tokens.spacing.md,
              paddingHorizontal: tokens.spacing.lg,
              borderTopWidth: 1,
              borderTopColor: colors.borderSubtle,
              gap: tokens.spacing.sm,
            }}
          >
            <Text style={{ fontSize: 18 }}>📁</Text>
            <View style={{ flex: 1 }}>
              <Text style={{
                fontSize: 16,
                fontWeight: '500',
                color: colors.textPrimary,
              }}>
                {vault.name}
              </Text>
              <Text style={{
                fontSize: 12,
                color: colors.textSecondary,
              }}>
                {t('workspace.last_accessed', '上次访问: {{time}}').replace('{{time}}', lastAccessed(vault))}
              </Text>
            </View>
            {isActive ? (
              <Text style={{ fontSize: 20, color: colors.primary }}>✓</Text>
            ) : (
              <View style={{ flexDirection: 'row', gap: tokens.spacing.sm }}>
                <Pressable
                  onPress={() => onSwitch(vault.name)}
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.7 : 1,
                    paddingHorizontal: tokens.spacing.sm,
                    paddingVertical: tokens.spacing.xs,
                    borderRadius: tokens.radius.md,
                    backgroundColor: colors.primaryContainer,
                  })}
                >
                  <Text style={{
                    fontSize: 14,
                    color: colors.onPrimaryContainer,
                    fontWeight: '600',
                  }}>
                    {t('workspace.switch', '切换')}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => handleDelete(vault.name)}
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.7 : 1,
                    paddingHorizontal: tokens.spacing.sm,
                    paddingVertical: tokens.spacing.xs,
                    borderRadius: tokens.radius.md,
                    backgroundColor: colors.errorContainer,
                  })}
                >
                  <Text style={{
                    fontSize: 14,
                    color: colors.onErrorContainer,
                    fontWeight: '600',
                  }}>
                    {t('workspace.delete', '删除')}
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        );
      })}

      {/* 创建新空间 */}
      <Pressable
        onPress={handleCreate}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          padding: tokens.spacing.md,
          paddingHorizontal: tokens.spacing.lg,
          borderTopWidth: 1,
          borderTopColor: colors.borderSubtle,
          gap: tokens.spacing.sm,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Text style={{ fontSize: 18, color: colors.primary }}>+</Text>
        <Text style={{
          fontSize: 16,
          color: colors.primary,
          fontWeight: '600',
        }}>
          {t('workspace.create_new', '创建新空间')}
        </Text>
      </Pressable>
    </View>
  );
};
