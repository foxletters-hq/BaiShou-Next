import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNativeTheme } from '@baishou/ui/src/native/theme';
import { useBaishou } from '../../providers/BaishouProvider';
import i18n from 'i18next';
import { ProfileSettingsCard, AboutSettingsCard, AppearanceSettingsCard, IdentitySettingsCard, WorkspaceSettingsCard, StorageSettingsCard } from '@baishou/ui/src/native';
import type { UserProfileConfig } from '@baishou/ui/src/native/IdentitySettingsCard/IdentitySettingsCard';
import type { VaultInfo } from '@baishou/ui/src/native/WorkspaceSettingsCard/WorkspaceSettingsCard';

export interface GeneralSettingsSectionProps {
  onNavigateToAttachments: () => void;
}

export const GeneralSettingsSection: React.FC<GeneralSettingsSectionProps> = ({
  onNavigateToAttachments,
}) => {
  const { t } = useTranslation();
  const { colors } = useNativeTheme();
  const { services, dbReady } = useBaishou();

  const [themeMode, setThemeMode] = useState<'system' | 'light' | 'dark'>('system');
  const [seedColor, setSeedColor] = useState('#007AFF');
  const [language, setLanguage] = useState('system');
  const [profile, setProfile] = useState<any>({ nickname: '', avatarPath: '' });
  const [storageStats, setStorageStats] = useState<any>({});
  
  // 工作区和身份卡状态
  const [vaults, setVaults] = useState<VaultInfo[]>([]);
  const [activeVault, setActiveVault] = useState<VaultInfo | null>(null);
  const [identityProfile, setIdentityProfile] = useState<UserProfileConfig>({
    nickname: '',
    activePersonaId: 'Default',
    personas: { 'Default': { id: 'Default', facts: {} } }
  });

  const loadVaults = async () => {
    if (!services || !dbReady) return;
    try {
      const allVaults = await services.vaultService.getAllVaults();
      const active = await services.vaultService.getActiveVault();
      setVaults(allVaults.map(v => ({
        name: v.name,
        path: v.path,
        createdAt: v.createdAt,
        lastAccessedAt: v.lastAccessedAt,
      })));
      if (active) {
        setActiveVault({
          name: active.name,
          path: active.path,
          createdAt: active.createdAt,
          lastAccessedAt: active.lastAccessedAt,
        });
      }
    } catch (e) {
      console.warn('Load vaults failed', e);
    }
  };

  useEffect(() => {
    if (!dbReady || !services) return;
    const loadSettings = async () => {
      try {
        const settings = await services.settingsManager.get<any>('settings') || {};
        if (settings.themeMode) setThemeMode(settings.themeMode);
        if (settings.seedColor) setSeedColor(settings.seedColor);
        if (settings.language) setLanguage(settings.language);
        
        const userProfile = await services.settingsManager.get<any>('user_profile') || {};
        setProfile(userProfile);
        
        if (userProfile.personas) {
          setIdentityProfile({
            nickname: userProfile.nickname || '',
            avatarPath: userProfile.avatarPath,
            activePersonaId: userProfile.activePersonaId || 'Default',
            personas: userProfile.personas || { 'Default': { id: 'Default', facts: {} } }
          });
        }
        
        const storageStatsData = await services.settingsManager.get<any>('storage_stats') || {};
        setStorageStats(storageStatsData);
      } catch (e) {
        console.warn('Load general settings failed', e);
      }
    };
    loadSettings();
    loadVaults();
  }, [dbReady, services]);

  const handleSaveProfile = async (newProfile: any) => {
    if (!services || !dbReady) return;
    try {
      await services.settingsManager.set('user_profile', newProfile);
      setProfile(newProfile);
      Alert.alert(t('common.success', '成功'), t('settings.profile_saved', '用户资料已保存'));
    } catch (e) {
      Alert.alert(t('common.error', '错误'), t('settings.save_failed', '保存失败'));
    }
  };

  const handleIdentityChange = async (newProfile: UserProfileConfig) => {
    if (!services || !dbReady) return;
    try {
      setIdentityProfile(newProfile);
      const userProfile = await services.settingsManager.get<any>('user_profile') || {};
      userProfile.personas = newProfile.personas;
      userProfile.activePersonaId = newProfile.activePersonaId;
      userProfile.nickname = newProfile.nickname;
      await services.settingsManager.set('user_profile', userProfile);
      setProfile({ ...profile, ...userProfile });
    } catch (e) {
      console.error('Save identity failed', e);
    }
  };

  const handleSaveTheme = async (mode: 'system' | 'light' | 'dark') => {
    if (!services || !dbReady) return;
    try {
      setThemeMode(mode);
      const settings = await services.settingsManager.get<any>('settings') || {};
      settings.themeMode = mode;
      await services.settingsManager.set('settings', settings);
    } catch (e) {
      console.error('Save theme failed', e);
    }
  };

  const handleSeedColorChange = async (color: string) => {
    if (!services || !dbReady) return;
    try {
      setSeedColor(color);
      const settings = await services.settingsManager.get<any>('settings') || {};
      settings.seedColor = color;
      await services.settingsManager.set('settings', settings);
    } catch (e) {
      console.error('Save seed color failed', e);
    }
  };

  const handleSaveLanguage = async (lang: string) => {
    if (!services || !dbReady) return;
    try {
      setLanguage(lang);
      const settings = await services.settingsManager.get<any>('settings') || {};
      settings.language = lang;
      await services.settingsManager.set('settings', settings);

      // 同步更新 i18n
      const targetLang = lang === 'system' ? 'zh' : lang;
      await i18n.changeLanguage(targetLang);
    } catch (e) {
      console.error('Save language failed', e);
    }
  };

  const handleSwitchVault = async (name: string) => {
    if (!services || !dbReady) return;
    try {
      await services.vaultService.switchVault(name);
      await loadVaults();
      Alert.alert(t('common.success', '成功'), t('settings.vault_switched', '工作区已切换'));
    } catch (e) {
      Alert.alert(t('common.error', '错误'), t('settings.vault_switch_failed', '切换工作区失败'));
    }
  };

  const handleDeleteVault = async (name: string) => {
    if (!services || !dbReady) return;
    try {
      await services.vaultService.deleteVault(name);
      await loadVaults();
    } catch (e) {
      Alert.alert(t('common.error', '错误'), t('settings.vault_delete_failed', '删除工作区失败'));
    }
  };

  const handleCreateVault = async (name: string) => {
    if (!services || !dbReady) return;
    try {
      await services.vaultService.switchVault(name);
      await loadVaults();
    } catch (e) {
      throw e;
    }
  };

  const handleExportData = async () => {
    if (!services || !dbReady) return;
    try {
      const zipPath = await services.archiveService.exportToUserDevice();
      if (zipPath) {
        Alert.alert(t('common.success', '成功'), t('settings.export_success', '数据已导出'));
      }
    } catch (e) {
      Alert.alert(t('common.error', '错误'), t('settings.export_failed', '导出失败'));
    }
  };

  const handleImportData = async () => {
    if (!services || !dbReady) return;
    try {
      Alert.alert(
        t('settings.import_confirm_title', '确认导入'),
        t('settings.import_confirm_message', '导入操作将覆盖现有数据，是否继续？'),
        [
          { text: t('common.cancel', '取消'), style: 'cancel' },
          {
            text: t('common.confirm', '确定'),
            style: 'destructive',
            onPress: async () => {
              try {
                const result = await services.archiveService.importFromZip('', true);
                if (result && (result.fileCount > 0 || result.fileCount === -1)) {
                  Alert.alert(t('common.success', '成功'), t('settings.import_success', '数据已导入'));
                } else {
                  Alert.alert(t('common.hint', '提示'), t('settings.import_no_files', '未检测到有效数据'));
                }
              } catch (e2: any) {
                Alert.alert(t('common.error', '错误'), e2.message || t('settings.import_failed', '导入失败'));
              }
            }
          }
        ]
      );
    } catch (e) {
      console.error('Import failed', e);
    }
  };

  return (
    <View style={styles.section}>
      <ProfileSettingsCard
        profile={profile}
        onSave={handleSaveProfile}
      />

      <IdentitySettingsCard
        profile={identityProfile}
        onChange={handleIdentityChange}
      />

      <AppearanceSettingsCard
        themeMode={themeMode}
        seedColor={seedColor}
        language={language as any}
        onThemeModeChange={handleSaveTheme}
        onSeedColorChange={handleSeedColorChange}
        onLanguageChange={handleSaveLanguage}
      />

      <WorkspaceSettingsCard
        vaults={vaults}
        activeVault={activeVault}
        onSwitch={handleSwitchVault}
        onDelete={handleDeleteVault}
        onCreate={handleCreateVault}
      />

      <StorageSettingsCard
        storageRootPath={storageStats.storageRootPath}
        sqliteSizeStats={storageStats.sqliteSizeStats || '0 MB'}
        vectorDbStats={storageStats.vectorDbStats || '0 MB'}
        mediaCacheStats={storageStats.mediaCacheStats || '0 MB'}
        onNavigateToAttachments={onNavigateToAttachments}
      />

      <Text style={[styles.sectionTitle, { color: colors.textSecondary, marginTop: 16 }]}>
        {t('settings.data_management', '数据管理')}
      </Text>

      <TouchableOpacity 
        style={[styles.actionButton, { backgroundColor: colors.primary }]}
        onPress={handleExportData}
      >
        <Text style={[styles.actionButtonText, { color: '#FFF' }]}>
          {t('settings.export_data', '导出数据')}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.actionButton, { backgroundColor: colors.bgSurfaceHighest }]}
        onPress={handleImportData}
      >
        <Text style={[styles.actionButtonText, { color: colors.textPrimary }]}>
          {t('settings.import_data', '导入数据')}
        </Text>
      </TouchableOpacity>

      <AboutSettingsCard
        version="2.0.0-Next-Canary"
        onOpenGithubHost={() => {}}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  actionButton: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
