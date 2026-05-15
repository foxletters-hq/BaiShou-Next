import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { StorageSettingsCard } from '@baishou/ui/native';
import { SettingsSection } from '@baishou/ui/native';
import { useNativeTheme } from '@baishou/ui/src/native/theme';
import { useBaishou } from '../providers/BaishouProvider';
import { useTranslation } from 'react-i18next';
import * as DocumentPicker from 'expo-document-picker';

export const StorageScreen: React.FC = () => {
  const { t } = useTranslation();
  const { colors, isDark } = useNativeTheme();
  const { services } = useBaishou();

  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const [storageRootPath, setStorageRootPath] = useState('');
  const [sqliteSize, setSqliteSize] = useState('--');
  const [vectorDbSize, setVectorDbSize] = useState('--');
  const [mediaCacheSize, setMediaCacheSize] = useState('--');

  useEffect(() => {
    const loadStats = async () => {
      try {
        if (services?.settingsManager) {
          const userData = await services.settingsManager.get<any>('user_data');
          if (userData?.storageRootPath) {
            setStorageRootPath(String(userData.storageRootPath));
          }
        }
      } catch (e) {
        console.error('Failed to load storage stats:', e);
      }
    };
    loadStats();
  }, [services]);

  const handleChangeRoot = useCallback(async () => {
    Alert.alert(
      t('settings.change_storage_root', '更换根目录'),
      t('storage.permission_not_available', '移动端暂不支持手动更换存储根目录，数据默认保存在应用沙盒内。'),
      [{ text: t('common.ok', '好的'), style: 'default' }],
    );
  }, [t]);

  const handleExport = useCallback(async () => {
    if (!services?.archiveService) {
      Alert.alert(t('common.error', '错误'), t('storage.service_unavailable', '归档服务未就绪'));
      return;
    }
    setIsExporting(true);
    try {
      const result = await services.archiveService.exportToUserDevice();
      if (result) {
        Alert.alert(
          t('settings.export_success', '导出成功'),
          t('settings.export_success_desc', '备份 ZIP 文件已保存。', { path: result }),
        );
      }
    } catch (e: any) {
      Alert.alert(t('settings.export_failed', '导出失败'), e.message);
    } finally {
      setIsExporting(false);
    }
  }, [services, t]);

  const handleImport = useCallback(async () => {
    if (!services?.archiveService) {
      Alert.alert(t('common.error', '错误'), t('storage.service_unavailable', '归档服务未就绪'));
      return;
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/zip',
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const confirmed = await new Promise<boolean>(resolve => {
        Alert.alert(
          t('settings.confirm_restore', '确认恢复'),
          t('settings.confirm_restore_desc', '恢复快照将覆盖当前所有数据。确认继续？'),
          [
            { text: t('common.cancel', '取消'), style: 'cancel', onPress: () => resolve(false) },
            { text: t('common.confirm', '确定'), style: 'destructive', onPress: () => resolve(true) },
          ],
        );
      });

      if (!confirmed) return;

      setIsImporting(true);
      const fileUri = result.assets[0].uri;
      await services.archiveService.importFromZip(fileUri);
      Alert.alert(
        t('settings.restore_success_simple', '数据恢复成功'),
        t('storage.restart_hint', '所有工作区数据和设备配置已还原，建议重启应用。'),
      );
    } catch (e: any) {
      Alert.alert(t('settings.restore_failed', '恢复失败'), e.message);
    } finally {
      setIsImporting(false);
    }
  }, [services, t]);

  const handleCreateSnapshot = useCallback(async () => {
    if (!services?.archiveService) return;
    try {
      const snapshotPath = await services.archiveService.createSnapshot();
      if (snapshotPath) {
        Alert.alert(
          t('common.success', '成功'),
          t('storage.snapshot_created', '快照已创建'),
        );
      }
    } catch (e: any) {
      Alert.alert(t('common.error', '错误'), e.message);
    }
  }, [services, t]);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bgApp }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.bgApp} />
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        <StorageSettingsCard
          storageRootPath={storageRootPath || t('storage.default_path', '应用沙盒')}
          sqliteSizeStats={sqliteSize}
          vectorDbStats={vectorDbSize}
          mediaCacheStats={mediaCacheSize}
          onChangeRoot={handleChangeRoot}
        />

        <View style={styles.sectionGap} />

        <SettingsSection
          title={t('settings.data_management', '数据管理')}
          description={t('settings.data_management_desc', '导出、导入数据或局域网快传')}
        >
          <TouchableOpacity
            style={[styles.menuItem, { borderBottomColor: colors.borderSubtle }]}
            onPress={handleExport}
            disabled={isExporting || isImporting}
          >
            <Text style={{ fontSize: 18 }}>📥</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.menuTitle, { color: colors.textPrimary }]}>
                {t('settings.export_data', '导出数据至本地')}
              </Text>
              <Text style={[styles.menuDesc, { color: colors.textSecondary }]}>
                {t('settings.export_desc', '生成一份包含所有内容的 ZIP 备份文件')}
              </Text>
            </View>
            {isExporting ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={[styles.chevron, { color: colors.textSecondary }]}>›</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, { borderBottomColor: colors.borderSubtle }]}
            onPress={handleImport}
            disabled={isExporting || isImporting}
          >
            <Text style={{ fontSize: 18 }}>📤</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.menuTitle, { color: colors.textPrimary }]}>
                {t('settings.import_data', '从外部 ZIP 导入')}
              </Text>
              <Text style={[styles.menuDesc, { color: colors.textSecondary }]}>
                {t('settings.import_desc', '选择本地 ZIP 文件覆盖恢复数据')}
              </Text>
            </View>
            {isImporting ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={[styles.chevron, { color: colors.textSecondary }]}>›</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={handleCreateSnapshot}
            disabled={isExporting || isImporting}
          >
            <Text style={{ fontSize: 18 }}>💾</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.menuTitle, { color: colors.textPrimary }]}>
                {t('storage.create_snapshot', '创建快照')}
              </Text>
              <Text style={[styles.menuDesc, { color: colors.textSecondary }]}>
                {t('storage.create_snapshot_desc', '保存当前数据的一份本地快照备份')}
              </Text>
            </View>
            <Text style={[styles.chevron, { color: colors.textSecondary }]}>›</Text>
          </TouchableOpacity>
        </SettingsSection>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  contentContainer: { padding: 16 },
  sectionGap: { height: 16 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  menuTitle: { fontSize: 15, fontWeight: '600' },
  menuDesc: { fontSize: 13, marginTop: 2 },
  chevron: { fontSize: 24, fontWeight: '300' },
});
