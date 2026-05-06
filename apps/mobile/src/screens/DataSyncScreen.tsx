import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, StatusBar, Alert, TextInput, Switch } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useNativeTheme } from '@baishou/ui/src/native/theme';
import { useBaishou } from '../providers/BaishouProvider';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

interface SyncTarget {
  id: string;
  type: 'webdav' | 's3' | 'local';
  name: string;
  url: string;
  username?: string;
  isEnabled: boolean;
  lastSync?: string;
  status: 'idle' | 'syncing' | 'error' | 'success';
}

export const DataSyncScreen: React.FC = () => {
  const { t } = useTranslation();
  const { colors, isDark } = useNativeTheme();
  const { services, dbReady } = useBaishou();
  const router = useRouter();

  const [syncTargets, setSyncTargets] = useState<SyncTarget[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTarget, setNewTarget] = useState({
    type: 'webdav' as 'webdav' | 's3' | 'local',
    name: '',
    url: '',
    username: '',
    password: '',
  });

  const archiveService = services?.archiveService;

  const loadSyncTargets = useCallback(async () => {
    if (!dbReady || !services) return;
    try {
      const targets = await services.settingsManager.get<SyncTarget[]>('sync_targets') || [];
      setSyncTargets(targets);
    } catch (e) {
      console.error('加载同步目标失败', e);
    }
  }, [dbReady, services]);

  useEffect(() => {
    loadSyncTargets();
  }, [loadSyncTargets]);

  const handleAddTarget = async () => {
    if (!newTarget.name.trim() || !newTarget.url.trim()) {
      Alert.alert(t('common.error', '错误'), t('sync.name_url_required', '名称和URL不能为空'));
      return;
    }

    try {
      const target: SyncTarget = {
        id: Date.now().toString(),
        type: newTarget.type,
        name: newTarget.name.trim(),
        url: newTarget.url.trim(),
        username: newTarget.username.trim() || undefined,
        isEnabled: true,
        status: 'idle',
      };

      const newTargets = [...syncTargets, target];
      await services?.settingsManager.set('sync_targets', newTargets);
      setSyncTargets(newTargets);
      setShowAddForm(false);
      setNewTarget({ type: 'webdav', name: '', url: '', username: '', password: '' });
      Alert.alert(t('common.success', '成功'), t('sync.target_added', '同步目标已添加'));
    } catch (e) {
      console.error('添加同步目标失败', e);
      Alert.alert(t('common.error', '错误'), t('sync.add_failed', '添加失败'));
    }
  };

  const handleDeleteTarget = async (targetId: string) => {
    Alert.alert(
      t('common.confirm', '确认删除'),
      t('sync.delete_confirm', '确定要删除这个同步目标吗？'),
      [
        { text: t('common.cancel', '取消'), style: 'cancel' },
        { 
          text: t('common.delete', '删除'), 
          style: 'destructive',
          onPress: async () => {
            try {
              const newTargets = syncTargets.filter(item => item.id !== targetId);
              await services?.settingsManager.set('sync_targets', newTargets);
              setSyncTargets(newTargets);
            } catch (e) {
              console.error('删除同步目标失败', e);
            }
          }
        },
      ]
    );
  };

  const handleToggleTarget = async (targetId: string) => {
    try {
      const newTargets = syncTargets.map(item => 
        item.id === targetId ? { ...item, isEnabled: !item.isEnabled } : item
      );
      await services?.settingsManager.set('sync_targets', newTargets);
      setSyncTargets(newTargets);
    } catch (e) {
      console.error('切换同步目标状态失败', e);
    }
  };

  const handleSyncNow = async (targetId: string) => {
    try {
      const newTargets = syncTargets.map(item => 
        item.id === targetId ? { ...item, status: 'syncing' as const } : item
      );
      setSyncTargets(newTargets);

      // 同步功能待实现，使用函数式更新避免闭包引用旧 state
      setTimeout(() => {
        setSyncTargets(prev => prev.map(item => 
          item.id === targetId ? { ...item, status: 'idle' as const, lastSync: new Date().toISOString() } : item
        ));
      }, 2000);
    } catch (e) {
      console.error('同步失败', e);
    }
  };

  const handleBackup = async () => {
    if (!archiveService) return;
    try {
      const zipPath = await archiveService.exportToUserDevice();
      if (zipPath) {
        Alert.alert(t('common.success', '成功'), t('sync.backup_success', '备份已保存'));
      }
    } catch (e) {
      console.error('备份失败', e);
      Alert.alert(t('common.error', '错误'), t('sync.backup_failed', '备份失败'));
    }
  };

  const handleRestore = async () => {
    if (!archiveService) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'application/zip' });
      if (!result.canceled && result.assets[0]) {
        Alert.alert(
          t('sync.confirm_restore', '确认恢复'),
          t('sync.restore_warning', '恢复将覆盖当前数据，是否继续？'),
          [
            { text: t('common.cancel', '取消'), style: 'cancel' },
            {
              text: t('common.confirm', '确认'),
              onPress: async () => {
                try {
                  await archiveService.importFromZip(result.assets[0].uri);
                  Alert.alert(t('common.success', '成功'), t('sync.restore_success', '恢复成功'));
                } catch (err) {
                  console.error('恢复失败', err);
                  Alert.alert(t('common.error', '错误'), t('sync.restore_failed', '恢复失败'));
                }
              }
            }
          ]
        );
      }
    } catch (e) {
      console.error('恢复失败', e);
      Alert.alert(t('common.error', '错误'), t('sync.restore_failed', '恢复失败'));
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'syncing': return colors.warning;
      case 'success': return colors.accentGreen;
      case 'error': return colors.error;
      default: return colors.textSecondary;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'syncing': return t('sync.syncing', '同步中...');
      case 'success': return t('common.success', '成功');
      case 'error': return t('common.error', '错误');
      default: return t('sync.idle', '空闲');
    }
  };

  return (
    <>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.bgApp} />
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bgApp }]}>
        <View style={[styles.container, { backgroundColor: colors.bgApp }]}>
          {/* 头部 */}
          <View style={[styles.header, { backgroundColor: colors.bgSurface, borderBottomColor: colors.borderSubtle }]}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Text style={[styles.backText, { color: colors.primary }]}>← {t('common.back', '返回')}</Text>
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t('sync.title', '数据同步')}</Text>
            <TouchableOpacity onPress={() => setShowAddForm(!showAddForm)}>
              <Text style={[styles.addButton, { color: colors.primary }]}>
                {showAddForm ? t('common.cancel', '取消') : `+ ${t('common.add', '添加')}`}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} indicatorStyle="white">
            {/* 快捷操作 */}
            <View style={[styles.section, { backgroundColor: colors.bgSurface }]}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('sync.quick_actions', '快捷操作')}</Text>
              
              <View style={styles.quickActions}>
                <TouchableOpacity 
                  style={[styles.quickActionButton, { backgroundColor: colors.primary + '20' }]}
                  onPress={handleBackup}
                >
                  <Text style={styles.quickActionIcon}>📤</Text>
                  <Text style={[styles.quickActionText, { color: colors.primary }]}>{t('sync.backup', '备份数据')}</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.quickActionButton, { backgroundColor: colors.primary + '20' }]}
                  onPress={handleRestore}
                >
                  <Text style={styles.quickActionIcon}>📥</Text>
                  <Text style={[styles.quickActionText, { color: colors.primary }]}>{t('sync.restore', '恢复数据')}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* 添加同步目标表单 */}
            {showAddForm && (
              <View style={[styles.section, { backgroundColor: colors.bgSurface }]}>
                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('sync.add_target', '添加同步目标')}</Text>
                
                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, { color: colors.textPrimary }]}>类型</Text>
                  <View style={styles.typeButtons}>
                    {(['webdav', 's3', 'local'] as const).map(type => (
                      <TouchableOpacity
                        key={type}
                        style={[
                          styles.typeButton,
                          { backgroundColor: colors.bgSurfaceHighest },
                          newTarget.type === type && { backgroundColor: colors.primary + '20' }
                        ]}
                        onPress={() => setNewTarget({ ...newTarget, type })}
                      >
                        <Text style={[
                          styles.typeButtonText,
                          { color: colors.textSecondary },
                          newTarget.type === type && { color: colors.primary }
                        ]}>
                          {type === 'webdav' ? 'WebDAV' : type === 's3' ? 'S3' : '本地'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, { color: colors.textPrimary }]}>名称</Text>
                  <TextInput
                    style={[styles.formInput, { 
                      backgroundColor: colors.bgSurfaceHighest,
                      color: colors.textPrimary,
                      borderColor: colors.borderSubtle,
                    }]}
                    value={newTarget.name}
                    onChangeText={(text) => setNewTarget({ ...newTarget, name: text })}
                    placeholder={t('sync.target_name_placeholder', '同步目标名称')}
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, { color: colors.textPrimary }]}>URL</Text>
                  <TextInput
                    style={[styles.formInput, { 
                      backgroundColor: colors.bgSurfaceHighest,
                      color: colors.textPrimary,
                      borderColor: colors.borderSubtle,
                    }]}
                    value={newTarget.url}
                    onChangeText={(text) => setNewTarget({ ...newTarget, url: text })}
                    placeholder={newTarget.type === 'webdav' ? 'https://example.com/webdav' : 
                                 newTarget.type === 's3' ? 'https://s3.amazonaws.com/bucket' : '/path/to/folder'}
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>

                {newTarget.type !== 'local' && (
                  <>
                    <View style={styles.formGroup}>
                      <Text style={[styles.formLabel, { color: colors.textPrimary }]}>用户名</Text>
                      <TextInput
                        style={[styles.formInput, { 
                          backgroundColor: colors.bgSurfaceHighest,
                          color: colors.textPrimary,
                          borderColor: colors.borderSubtle,
                        }]}
                        value={newTarget.username}
                        onChangeText={(text) => setNewTarget({ ...newTarget, username: text })}
                        placeholder={t('sync.username_placeholder', '用户名（可选）')}
                        placeholderTextColor={colors.textSecondary}
                      />
                    </View>

                    <View style={styles.formGroup}>
                      <Text style={[styles.formLabel, { color: colors.textPrimary }]}>密码</Text>
                      <TextInput
                        style={[styles.formInput, { 
                          backgroundColor: colors.bgSurfaceHighest,
                          color: colors.textPrimary,
                          borderColor: colors.borderSubtle,
                        }]}
                        value={newTarget.password}
                        onChangeText={(text) => setNewTarget({ ...newTarget, password: text })}
                        placeholder={t('sync.password_placeholder', '密码（可选）')}
                        placeholderTextColor={colors.textSecondary}
                        secureTextEntry
                      />
                    </View>
                  </>
                )}

                <TouchableOpacity 
                  style={[styles.saveButton, { backgroundColor: colors.primary }]}
                  onPress={handleAddTarget}
                >
                  <Text style={[styles.saveButtonText, { color: '#FFF' }]}>{t('common.add', '添加')}</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* 同步目标列表 */}
            <View style={[styles.section, { backgroundColor: colors.bgSurface }]}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('sync.targets', '同步目标')}</Text>
              
              {syncTargets.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyIcon}>☁️</Text>
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t('sync.no_targets', '暂无同步目标')}</Text>
                  <Text style={[styles.emptySubText, { color: colors.textSecondary }]}>{t('sync.add_hint', '点击右上角添加按钮配置同步目标')}</Text>
                </View>
              ) : (
                syncTargets.map(target => (
                  <View key={target.id} style={[styles.targetItem, { backgroundColor: colors.bgSurfaceHighest }]}>
                    <View style={styles.targetInfo}>
                      <View style={styles.targetHeader}>
                        <Text style={[styles.targetName, { color: colors.textPrimary }]}>{target.name}</Text>
                        <View style={[
                          styles.statusBadge, 
                          { backgroundColor: getStatusColor(target.status) + '20' }
                        ]}>
                          <Text style={[styles.statusText, { color: getStatusColor(target.status) }]}>
                            {getStatusText(target.status)}
                          </Text>
                        </View>
                      </View>
                      
                      <Text style={[styles.targetUrl, { color: colors.textSecondary }]} numberOfLines={1}>
                        {target.url}
                      </Text>
                      
                      {target.lastSync && (
                        <Text style={[styles.lastSync, { color: colors.textSecondary }]}>
                          {t('sync.last_sync', '上次同步')}: {new Date(target.lastSync).toLocaleString()}
                        </Text>
                      )}
                    </View>

                    <View style={styles.targetActions}>
                      <Switch
                        value={target.isEnabled}
                        onValueChange={() => handleToggleTarget(target.id)}
                        trackColor={{ false: colors.bgSurface, true: colors.primary + '80' }}
                        thumbColor={target.isEnabled ? colors.primary : colors.textSecondary}
                      />
                      <TouchableOpacity 
                        style={[styles.syncButton, { backgroundColor: colors.primary + '20' }]}
                        onPress={() => handleSyncNow(target.id)}
                        disabled={!target.isEnabled || target.status === 'syncing'}
                      >
                        <Text style={[styles.syncButtonText, { color: colors.primary }]}>{t('sync.sync_now', '同步')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={styles.deleteButton}
                        onPress={() => handleDeleteTarget(target.id)}
                      >
                        <Text style={[styles.deleteButtonText, { color: colors.error }]}>{t('common.delete', '删除')}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    </>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  backText: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  addButton: {
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
  },
  quickActionButton: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
  },
  quickActionIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  quickActionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  formInput: {
    height: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  typeButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  typeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  saveButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 24,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  emptySubText: {
    fontSize: 14,
    textAlign: 'center',
  },
  targetItem: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  targetInfo: {
    marginBottom: 12,
  },
  targetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  targetName: {
    fontSize: 16,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  targetUrl: {
    fontSize: 14,
    marginBottom: 4,
  },
  lastSync: {
    fontSize: 12,
  },
  targetActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  syncButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  syncButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  deleteButton: {
    padding: 8,
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
