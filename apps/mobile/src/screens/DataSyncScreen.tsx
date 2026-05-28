import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Alert,
  TextInput,
  Switch,
  RefreshControl
} from 'react-native'
import * as DocumentPicker from 'expo-document-picker'
import { useNativeTheme, scrollIndicatorStyle } from '@baishou/ui/native'
import { logger } from '@baishou/shared'
import { useBaishou } from '../providers/BaishouProvider'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { SyncConfig, SyncRecord } from '@baishou/core-mobile'

interface SyncTarget {
  id: string
  type: 'webdav' | 's3' | 'local'
  name: string
  url: string
  username?: string
  password?: string
  // S3 专用字段
  s3Bucket?: string
  s3Region?: string
  s3Path?: string
  isEnabled: boolean
  lastSync?: string
  status: 'idle' | 'syncing' | 'error' | 'success'
}

export const DataSyncScreen: React.FC = () => {
  const { t } = useTranslation()
  const { colors, isDark } = useNativeTheme()
  const { services, dbReady } = useBaishou()
  const router = useRouter()

  const [syncTargets, setSyncTargets] = useState<SyncTarget[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [newTarget, setNewTarget] = useState({
    type: 'webdav' as 'webdav' | 's3' | 'local',
    name: '',
    url: '',
    username: '',
    password: '',
    s3Bucket: '',
    s3Region: '',
    s3Path: ''
  })

  // 云端备份记录相关状态
  const [cloudRecords, setCloudRecords] = useState<SyncRecord[]>([])
  const [recordsLoading, setRecordsLoading] = useState(false)
  const [recordsRefreshing, setRecordsRefreshing] = useState(false)
  const [activeTargetId, setActiveTargetId] = useState<string | null>(null)
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false)
  const [selectedRecords, setSelectedRecords] = useState<Set<string>>(new Set())
  const [renamingRecord, setRenamingRecord] = useState<string | null>(null)
  const [newRecordName, setNewRecordName] = useState('')

  const archiveService = services?.archiveService
  const cloudSyncService = services?.cloudSyncService

  const loadSyncTargets = useCallback(async () => {
    if (!dbReady || !services) return
    try {
      const targets = (await services.settingsManager.get<SyncTarget[]>('sync_targets')) || []
      setSyncTargets(targets)
    } catch (e) {
      logger.error('加载同步目标失败', e instanceof Error ? e : String(e))
    }
  }, [dbReady, services])

  useEffect(() => {
    loadSyncTargets()
  }, [loadSyncTargets])

  // 根据同步目标构建 SyncConfig
  const buildSyncConfig = useCallback(
    (target: SyncTarget): SyncConfig => ({
      target: target.type,
      maxBackupCount: 5,
      maxSnapshotCount: 5,
      webdavUrl: target.url,
      webdavUsername: target.username || '',
      webdavPassword: target.password || '',
      webdavPath: '/',
      s3Endpoint: target.url,
      s3Region: target.s3Region || '',
      s3Bucket: target.s3Bucket || '',
      s3Path: target.s3Path || '',
      s3AccessKey: target.username || '',
      s3SecretKey: target.password || ''
    }),
    []
  )

  // 加载云端备份记录
  const loadCloudRecords = useCallback(
    async (targetId: string) => {
      if (!cloudSyncService) return
      const target = syncTargets.find((t) => t.id === targetId)
      if (!target || target.type === 'local') return

      try {
        setRecordsLoading(true)
        setActiveTargetId(targetId)
        const config = buildSyncConfig(target)
        const records = await cloudSyncService.listRecords(config)
        setCloudRecords(records)
      } catch (e) {
        logger.error('加载云端记录失败', e instanceof Error ? e : String(e))
        Alert.alert(
          t('common.error', '错误'),
          t('data_sync.load_records_failed', '加载云端记录失败')
        )
      } finally {
        setRecordsLoading(false)
      }
    },
    [cloudSyncService, syncTargets, buildSyncConfig, t]
  )

  // 下拉刷新
  const handleRefreshRecords = useCallback(async () => {
    if (!activeTargetId) return
    setRecordsRefreshing(true)
    await loadCloudRecords(activeTargetId)
    setRecordsRefreshing(false)
  }, [activeTargetId, loadCloudRecords])

  // 从云端恢复备份
  const handleRestoreRecord = useCallback(
    (targetId: string, filename: string) => {
      Alert.alert(
        t('data_sync.confirm_cloud_restore', '确认恢复'),
        t('data_sync.cloud_restore_warning', '恢复将覆盖当前数据，是否继续？'),
        [
          { text: t('common.cancel', '取消'), style: 'cancel' },
          {
            text: t('common.confirm', '确认'),
            onPress: async () => {
              if (!cloudSyncService) return
              const target = syncTargets.find((t) => t.id === targetId)
              if (!target) return
              try {
                const config = buildSyncConfig(target)
                const result = await cloudSyncService.restoreFromCloud(config, filename)
                Alert.alert(
                  result.success ? t('common.success', '成功') : t('common.error', '错误'),
                  result.message
                )
              } catch (e) {
                logger.error('云端恢复失败', e instanceof Error ? e : String(e))
                Alert.alert(t('common.error', '错误'), t('data_sync.restore_failed', '恢复失败'))
              }
            }
          }
        ]
      )
    },
    [cloudSyncService, syncTargets, buildSyncConfig, t]
  )

  // 删除单条云端记录
  const handleDeleteCloudRecord = useCallback(
    (targetId: string, filename: string) => {
      Alert.alert(
        t('data_sync.confirm_delete_record', '确认删除'),
        t('data_sync.delete_record_warning', '确定要删除备份记录 "{{name}}" 吗？', {
          name: filename
        }),
        [
          { text: t('common.cancel', '取消'), style: 'cancel' },
          {
            text: t('common.delete', '删除'),
            style: 'destructive',
            onPress: async () => {
              if (!cloudSyncService) return
              const target = syncTargets.find((t) => t.id === targetId)
              if (!target) return
              try {
                const config = buildSyncConfig(target)
                await cloudSyncService.deleteRecord(config, filename)
                setCloudRecords((prev) => prev.filter((r) => r.filename !== filename))
                Alert.alert(
                  t('common.success', '成功'),
                  t('data_sync.record_deleted', '记录已删除')
                )
              } catch (e) {
                logger.error('删除云端记录失败', e instanceof Error ? e : String(e))
                Alert.alert(
                  t('common.error', '错误'),
                  t('data_sync.delete_record_failed', '删除失败')
                )
              }
            }
          }
        ]
      )
    },
    [cloudSyncService, syncTargets, buildSyncConfig, t]
  )

  // 批量删除云端记录
  const handleBatchDeleteRecords = useCallback(
    (targetId: string) => {
      const filenames = Array.from(selectedRecords)
      if (filenames.length === 0) return

      Alert.alert(
        t('data_sync.confirm_batch_delete', '确认批量删除'),
        t('data_sync.batch_delete_warning', '确定要删除选中的 {{count}} 条记录吗？', {
          count: filenames.length
        }),
        [
          { text: t('common.cancel', '取消'), style: 'cancel' },
          {
            text: t('common.delete', '删除'),
            style: 'destructive',
            onPress: async () => {
              if (!cloudSyncService) return
              const target = syncTargets.find((t) => t.id === targetId)
              if (!target) return
              try {
                const config = buildSyncConfig(target)
                const deleted = await cloudSyncService.batchDeleteRecords(config, filenames)
                setCloudRecords((prev) => prev.filter((r) => !selectedRecords.has(r.filename)))
                setSelectedRecords(new Set())
                setIsMultiSelectMode(false)
                Alert.alert(
                  t('common.success', '成功'),
                  t('data_sync.batch_deleted', '已删除 {{count}} 条记录', { count: deleted })
                )
              } catch (e) {
                logger.error('批量删除云端记录失败', e instanceof Error ? e : String(e))
                Alert.alert(
                  t('common.error', '错误'),
                  t('data_sync.batch_delete_failed', '批量删除失败')
                )
              }
            }
          }
        ]
      )
    },
    [cloudSyncService, syncTargets, buildSyncConfig, selectedRecords, t]
  )

  // 重命名云端记录
  const handleRenameRecord = useCallback(
    async (targetId: string, oldName: string) => {
      if (!newRecordName.trim()) {
        Alert.alert(t('common.error', '错误'), t('data_sync.name_required', '名称不能为空'))
        return
      }
      if (!cloudSyncService) return
      const target = syncTargets.find((t) => t.id === targetId)
      if (!target) return
      try {
        const config = buildSyncConfig(target)
        await cloudSyncService.renameRecord(config, oldName, newRecordName.trim())
        setCloudRecords((prev) =>
          prev.map((r) => (r.filename === oldName ? { ...r, filename: newRecordName.trim() } : r))
        )
        setRenamingRecord(null)
        setNewRecordName('')
        Alert.alert(t('common.success', '成功'), t('data_sync.record_renamed', '记录已重命名'))
      } catch (e) {
        logger.error('重命名云端记录失败', e instanceof Error ? e : String(e))
        Alert.alert(t('common.error', '错误'), t('data_sync.rename_failed', '重命名失败'))
      }
    },
    [cloudSyncService, syncTargets, buildSyncConfig, newRecordName, t]
  )

  // 切换记录选中状态
  const toggleRecordSelection = useCallback((filename: string) => {
    setSelectedRecords((prev) => {
      const next = new Set(prev)
      if (next.has(filename)) {
        next.delete(filename)
      } else {
        next.add(filename)
      }
      return next
    })
  }, [])

  // 格式化文件大小
  const formatSize = useCallback((bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }, [])

  const handleAddTarget = async () => {
    if (!newTarget.name.trim() || !newTarget.url.trim()) {
      Alert.alert(t('common.error', '错误'), t('data_sync.name_url_required', '名称和URL不能为空'))
      return
    }

    // S3 类型需要校验必填字段
    if (newTarget.type === 's3') {
      if (!newTarget.s3Bucket.trim()) {
        Alert.alert(
          t('common.error', '错误'),
          t('data_sync.s3_bucket_required', 'S3 Bucket 不能为空')
        )
        return
      }
    }

    try {
      const target: SyncTarget = {
        id: Date.now().toString(),
        type: newTarget.type,
        name: newTarget.name.trim(),
        url: newTarget.url.trim(),
        username: newTarget.username.trim() || undefined,
        password: newTarget.password.trim() || undefined,
        s3Bucket: newTarget.type === 's3' ? newTarget.s3Bucket.trim() : undefined,
        s3Region: newTarget.type === 's3' ? newTarget.s3Region.trim() : undefined,
        s3Path: newTarget.type === 's3' ? newTarget.s3Path.trim() : undefined,
        isEnabled: true,
        status: 'idle'
      }

      const newTargets = [...syncTargets, target]
      await services?.settingsManager.set('sync_targets', newTargets)
      setSyncTargets(newTargets)
      setShowAddForm(false)
      setNewTarget({
        type: 'webdav',
        name: '',
        url: '',
        username: '',
        password: '',
        s3Bucket: '',
        s3Region: '',
        s3Path: ''
      })
      Alert.alert(t('common.success', '成功'), t('data_sync.target_added', '同步目标已添加'))
    } catch (e) {
      logger.error('添加同步目标失败', e instanceof Error ? e : String(e))
      Alert.alert(t('common.error', '错误'), t('data_sync.add_failed', '添加失败'))
    }
  }

  const handleDeleteTarget = async (targetId: string) => {
    Alert.alert(
      t('common.confirm', '确认删除'),
      t('data_sync.delete_confirm', '确定要删除这个同步目标吗？'),
      [
        { text: t('common.cancel', '取消'), style: 'cancel' },
        {
          text: t('common.delete', '删除'),
          style: 'destructive',
          onPress: async () => {
            try {
              const newTargets = syncTargets.filter((item) => item.id !== targetId)
              await services?.settingsManager.set('sync_targets', newTargets)
              setSyncTargets(newTargets)
            } catch (e) {
              logger.error('删除同步目标失败', e instanceof Error ? e : String(e))
            }
          }
        }
      ]
    )
  }

  const handleToggleTarget = async (targetId: string) => {
    try {
      const newTargets = syncTargets.map((item) =>
        item.id === targetId ? { ...item, isEnabled: !item.isEnabled } : item
      )
      await services?.settingsManager.set('sync_targets', newTargets)
      setSyncTargets(newTargets)
    } catch (e) {
      logger.error('切换同步目标状态失败', e instanceof Error ? e : String(e))
    }
  }

  const handleSyncNow = async (targetId: string) => {
    if (!cloudSyncService || !services) return

    const target = syncTargets.find((t) => t.id === targetId)
    if (!target) return

    try {
      // 更新状态为同步中
      const newTargets = syncTargets.map((item) =>
        item.id === targetId ? { ...item, status: 'syncing' as const } : item
      )
      setSyncTargets(newTargets)

      // 构建同步配置
      const syncConfig = buildSyncConfig(target)

      // 调用真实的同步服务
      const result = await cloudSyncService.syncNow(syncConfig)

      // 更新状态
      const updatedTargets = syncTargets.map((item) =>
        item.id === targetId
          ? {
              ...item,
              status: result.success ? ('success' as const) : ('error' as const),
              lastSync: new Date().toISOString()
            }
          : item
      )
      setSyncTargets(updatedTargets)

      // 持久化同步状态到数据库
      await services.settingsManager.set('sync_targets', updatedTargets)

      // 显示结果提示
      Alert.alert(
        result.success ? t('common.success', '成功') : t('common.error', '错误'),
        result.message
      )

      // 3秒后重置状态
      setTimeout(() => {
        setSyncTargets((prev) =>
          prev.map((item) => (item.id === targetId ? { ...item, status: 'idle' as const } : item))
        )
      }, 3000)
    } catch (e) {
      logger.error('同步失败', e instanceof Error ? e : String(e))
      setSyncTargets((prev) =>
        prev.map((item) => (item.id === targetId ? { ...item, status: 'error' as const } : item))
      )
      Alert.alert(t('common.error', '错误'), t('data_sync.sync_failed', '同步失败'))
    }
  }

  const handleBackup = async () => {
    if (!archiveService) return
    try {
      const zipPath = await archiveService.exportToUserDevice()
      if (zipPath) {
        Alert.alert(t('common.success', '成功'), t('data_sync.backup_success', '备份已保存'))
      }
    } catch (e) {
      logger.error('备份失败', e instanceof Error ? e : String(e))
      Alert.alert(t('common.error', '错误'), t('data_sync.backup_failed', '备份失败'))
    }
  }

  const handleRestore = async () => {
    if (!archiveService) return
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/zip'
      })
      if (!result.canceled && result.assets[0]) {
        Alert.alert(
          t('data_sync.confirm_restore', '确认恢复'),
          t('data_sync.restore_warning', '恢复将覆盖当前数据，是否继续？'),
          [
            { text: t('common.cancel', '取消'), style: 'cancel' },
            {
              text: t('common.confirm', '确认'),
              onPress: async () => {
                try {
                  await archiveService.importFromZip(result.assets[0].uri)
                  Alert.alert(
                    t('common.success', '成功'),
                    t('data_sync.restore_success', '恢复成功')
                  )
                } catch (err) {
                  logger.error('恢复失败', err instanceof Error ? err : String(err))
                  Alert.alert(t('common.error', '错误'), t('data_sync.restore_failed', '恢复失败'))
                }
              }
            }
          ]
        )
      }
    } catch (e) {
      logger.error('恢复失败', e instanceof Error ? e : String(e))
      Alert.alert(t('common.error', '错误'), t('data_sync.restore_failed', '恢复失败'))
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'syncing':
        return colors.warning
      case 'success':
        return colors.accentGreen
      case 'error':
        return colors.error
      default:
        return colors.textSecondary
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'syncing':
        return t('data_sync.syncing', '同步中...')
      case 'success':
        return t('common.success', '成功')
      case 'error':
        return t('common.error', '错误')
      default:
        return t('data_sync.idle', '空闲')
    }
  }

  return (
    <>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.bgApp}
      />
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bgApp }]}>
        <View style={[styles.container, { backgroundColor: colors.bgApp }]}>
          {/* 头部 */}
          <View
            style={[
              styles.header,
              {
                backgroundColor: colors.bgSurface,
                borderBottomColor: colors.borderSubtle
              }
            ]}
          >
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Text style={[styles.backText, { color: colors.primary }]}>
                ← {t('common.back', '返回')}
              </Text>
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
              {t('data_sync.title', '数据同步')}
            </Text>
            <TouchableOpacity onPress={() => setShowAddForm(!showAddForm)}>
              <Text style={[styles.addButton, { color: colors.primary }]}>
                {showAddForm ? t('common.cancel', '取消') : `+ ${t('common.add', '添加')}`}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} indicatorStyle={scrollIndicatorStyle(isDark)}>
            {/* 快捷操作 */}
            <View style={[styles.section, { backgroundColor: colors.bgSurface }]}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                {t('data_sync.quick_actions', '快捷操作')}
              </Text>

              <View style={styles.quickActions}>
                <TouchableOpacity
                  style={[styles.quickActionButton, { backgroundColor: colors.primary + '20' }]}
                  onPress={handleBackup}
                >
                  <Text style={styles.quickActionIcon}>📤</Text>
                  <Text style={[styles.quickActionText, { color: colors.primary }]}>
                    {t('data_sync.backup', '备份数据')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.quickActionButton, { backgroundColor: colors.primary + '20' }]}
                  onPress={handleRestore}
                >
                  <Text style={styles.quickActionIcon}>📥</Text>
                  <Text style={[styles.quickActionText, { color: colors.primary }]}>
                    {t('data_sync.restore', '恢复数据')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* 添加同步目标表单 */}
            {showAddForm && (
              <View style={[styles.section, { backgroundColor: colors.bgSurface }]}>
                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                  {t('data_sync.add_target', '添加同步目标')}
                </Text>

                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, { color: colors.textPrimary }]}>类型</Text>
                  <View style={styles.typeButtons}>
                    {(['webdav', 's3', 'local'] as const).map((type) => (
                      <TouchableOpacity
                        key={type}
                        style={[
                          styles.typeButton,
                          { backgroundColor: colors.bgSurfaceHighest },
                          newTarget.type === type && {
                            backgroundColor: colors.primary + '20'
                          }
                        ]}
                        onPress={() => setNewTarget({ ...newTarget, type })}
                      >
                        <Text
                          style={[
                            styles.typeButtonText,
                            { color: colors.textSecondary },
                            newTarget.type === type && {
                              color: colors.primary
                            }
                          ]}
                        >
                          {type === 'webdav' ? 'WebDAV' : type === 's3' ? 'S3' : '本地'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, { color: colors.textPrimary }]}>名称</Text>
                  <TextInput
                    style={[
                      styles.formInput,
                      {
                        backgroundColor: colors.bgSurfaceHighest,
                        color: colors.textPrimary,
                        borderColor: colors.borderSubtle
                      }
                    ]}
                    value={newTarget.name}
                    onChangeText={(text) => setNewTarget({ ...newTarget, name: text })}
                    placeholder={t('data_sync.target_name_placeholder', '同步目标名称')}
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, { color: colors.textPrimary }]}>URL</Text>
                  <TextInput
                    style={[
                      styles.formInput,
                      {
                        backgroundColor: colors.bgSurfaceHighest,
                        color: colors.textPrimary,
                        borderColor: colors.borderSubtle
                      }
                    ]}
                    value={newTarget.url}
                    onChangeText={(text) => setNewTarget({ ...newTarget, url: text })}
                    placeholder={
                      newTarget.type === 'webdav'
                        ? 'https://example.com/webdav'
                        : newTarget.type === 's3'
                          ? 'https://s3.example.com/bucket'
                          : '/path/to/folder'
                    }
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>

                {newTarget.type !== 'local' && (
                  <>
                    <View style={styles.formGroup}>
                      <Text style={[styles.formLabel, { color: colors.textPrimary }]}>用户名</Text>
                      <TextInput
                        style={[
                          styles.formInput,
                          {
                            backgroundColor: colors.bgSurfaceHighest,
                            color: colors.textPrimary,
                            borderColor: colors.borderSubtle
                          }
                        ]}
                        value={newTarget.username}
                        onChangeText={(text) => setNewTarget({ ...newTarget, username: text })}
                        placeholder={
                          newTarget.type === 's3'
                            ? t('data_sync.s3_access_key_placeholder', 'Access Key')
                            : t('data_sync.username_placeholder', '用户名（可选）')
                        }
                        placeholderTextColor={colors.textSecondary}
                      />
                    </View>

                    <View style={styles.formGroup}>
                      <Text style={[styles.formLabel, { color: colors.textPrimary }]}>
                        {newTarget.type === 's3' ? 'Secret Key' : '密码'}
                      </Text>
                      <TextInput
                        style={[
                          styles.formInput,
                          {
                            backgroundColor: colors.bgSurfaceHighest,
                            color: colors.textPrimary,
                            borderColor: colors.borderSubtle
                          }
                        ]}
                        value={newTarget.password}
                        onChangeText={(text) => setNewTarget({ ...newTarget, password: text })}
                        placeholder={
                          newTarget.type === 's3'
                            ? t('data_sync.s3_secret_key_placeholder', 'Secret Key（可选）')
                            : t('data_sync.password_placeholder', '密码（可选）')
                        }
                        placeholderTextColor={colors.textSecondary}
                        secureTextEntry
                      />
                    </View>

                    {/* S3 专用字段 */}
                    {newTarget.type === 's3' && (
                      <>
                        <View style={styles.formGroup}>
                          <Text style={[styles.formLabel, { color: colors.textPrimary }]}>
                            Bucket *
                          </Text>
                          <TextInput
                            style={[
                              styles.formInput,
                              {
                                backgroundColor: colors.bgSurfaceHighest,
                                color: colors.textPrimary,
                                borderColor: colors.borderSubtle
                              }
                            ]}
                            value={newTarget.s3Bucket}
                            onChangeText={(text) => setNewTarget({ ...newTarget, s3Bucket: text })}
                            placeholder={t('data_sync.s3_bucket_placeholder', 'S3 Bucket 名称')}
                            placeholderTextColor={colors.textSecondary}
                          />
                        </View>

                        <View style={styles.formGroup}>
                          <Text style={[styles.formLabel, { color: colors.textPrimary }]}>
                            Region
                          </Text>
                          <TextInput
                            style={[
                              styles.formInput,
                              {
                                backgroundColor: colors.bgSurfaceHighest,
                                color: colors.textPrimary,
                                borderColor: colors.borderSubtle
                              }
                            ]}
                            value={newTarget.s3Region}
                            onChangeText={(text) => setNewTarget({ ...newTarget, s3Region: text })}
                            placeholder={t('data_sync.s3_region_placeholder', '例如: us-east-1')}
                            placeholderTextColor={colors.textSecondary}
                          />
                        </View>

                        <View style={styles.formGroup}>
                          <Text style={[styles.formLabel, { color: colors.textPrimary }]}>
                            Path
                          </Text>
                          <TextInput
                            style={[
                              styles.formInput,
                              {
                                backgroundColor: colors.bgSurfaceHighest,
                                color: colors.textPrimary,
                                borderColor: colors.borderSubtle
                              }
                            ]}
                            value={newTarget.s3Path}
                            onChangeText={(text) => setNewTarget({ ...newTarget, s3Path: text })}
                            placeholder={t('data_sync.s3_path_placeholder', '例如: /backups/')}
                            placeholderTextColor={colors.textSecondary}
                          />
                        </View>
                      </>
                    )}
                  </>
                )}

                <TouchableOpacity
                  style={[styles.saveButton, { backgroundColor: colors.primary }]}
                  onPress={handleAddTarget}
                >
                  <Text style={[styles.saveButtonText, { color: colors.textOnPrimary }]}>
                    {t('common.add', '添加')}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* 同步目标列表 */}
            <View style={[styles.section, { backgroundColor: colors.bgSurface }]}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                {t('data_sync.targets', '同步目标')}
              </Text>

              {syncTargets.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyIcon}>☁️</Text>
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                    {t('data_sync.no_targets', '暂无同步目标')}
                  </Text>
                  <Text style={[styles.emptySubText, { color: colors.textSecondary }]}>
                    {t('data_sync.add_hint', '点击右上角添加按钮配置同步目标')}
                  </Text>
                </View>
              ) : (
                syncTargets.map((target) => (
                  <View
                    key={target.id}
                    style={[styles.targetItem, { backgroundColor: colors.bgSurfaceHighest }]}
                  >
                    <View style={styles.targetInfo}>
                      <View style={styles.targetHeader}>
                        <Text style={[styles.targetName, { color: colors.textPrimary }]}>
                          {target.name}
                        </Text>
                        <View
                          style={[
                            styles.statusBadge,
                            {
                              backgroundColor: getStatusColor(target.status) + '20'
                            }
                          ]}
                        >
                          <Text
                            style={[styles.statusText, { color: getStatusColor(target.status) }]}
                          >
                            {getStatusText(target.status)}
                          </Text>
                        </View>
                      </View>

                      <Text
                        style={[styles.targetUrl, { color: colors.textSecondary }]}
                        numberOfLines={1}
                      >
                        {target.url}
                      </Text>

                      {target.lastSync && (
                        <Text style={[styles.lastSync, { color: colors.textSecondary }]}>
                          {t('data_sync.last_sync', '上次同步')}:{' '}
                          {new Date(target.lastSync).toLocaleString()}
                        </Text>
                      )}
                    </View>

                    <View style={styles.targetActions}>
                      <Switch
                        value={target.isEnabled}
                        onValueChange={() => handleToggleTarget(target.id)}
                        trackColor={{
                          false: colors.bgSurface,
                          true: colors.primary + '80'
                        }}
                        thumbColor={target.isEnabled ? colors.primary : colors.textSecondary}
                      />
                      <TouchableOpacity
                        style={[styles.syncButton, { backgroundColor: colors.primary + '20' }]}
                        onPress={() => handleSyncNow(target.id)}
                        disabled={!target.isEnabled || target.status === 'syncing'}
                      >
                        <Text style={[styles.syncButtonText, { color: colors.primary }]}>
                          {t('data_sync.sync_now', '同步')}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => handleDeleteTarget(target.id)}
                      >
                        <Text style={[styles.deleteButtonText, { color: colors.error }]}>
                          {t('common.delete', '删除')}
                        </Text>
                      </TouchableOpacity>
                      {target.type !== 'local' && (
                        <TouchableOpacity
                          style={[styles.recordsButton, { backgroundColor: colors.primary + '20' }]}
                          onPress={() => loadCloudRecords(target.id)}
                        >
                          <Text style={[styles.recordsButtonText, { color: colors.primary }]}>
                            {t('data_sync.cloud_records', '云端记录')}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                ))
              )}
            </View>

            {/* 云端备份记录列表 */}
            {activeTargetId && (
              <View style={[styles.section, { backgroundColor: colors.bgSurface }]}>
                <View style={styles.recordsHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                    {t('data_sync.cloud_backup_records', '云端备份记录')} ({cloudRecords.length})
                  </Text>
                  <View style={styles.recordsHeaderActions}>
                    {cloudRecords.length > 0 && (
                      <TouchableOpacity
                        onPress={() => {
                          setIsMultiSelectMode(!isMultiSelectMode)
                          setSelectedRecords(new Set())
                        }}
                      >
                        <Text style={[styles.multiSelectToggle, { color: colors.primary }]}>
                          {isMultiSelectMode
                            ? t('common.cancel', '取消')
                            : t('data_sync.multi_select', '多选')}
                        </Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={() => setActiveTargetId(null)}>
                      <Text style={[styles.closeRecordsButton, { color: colors.textSecondary }]}>
                        ✕
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* 批量删除操作栏 */}
                {isMultiSelectMode && selectedRecords.size > 0 && (
                  <TouchableOpacity
                    style={[styles.batchDeleteButton, { backgroundColor: colors.error + '20' }]}
                    onPress={() => handleBatchDeleteRecords(activeTargetId)}
                  >
                    <Text style={[styles.batchDeleteText, { color: colors.error }]}>
                      {t('data_sync.batch_delete', '批量删除')} ({selectedRecords.size})
                    </Text>
                  </TouchableOpacity>
                )}

                {recordsLoading ? (
                  <View style={styles.loadingContainer}>
                    <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                      {t('common.loading', '加载中...')}
                    </Text>
                  </View>
                ) : cloudRecords.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyIcon}>📭</Text>
                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                      {t('data_sync.no_cloud_records', '暂无云端备份记录')}
                    </Text>
                  </View>
                ) : (
                  <ScrollView
                    style={styles.recordsList}
                    refreshControl={
                      <RefreshControl
                        refreshing={recordsRefreshing}
                        onRefresh={handleRefreshRecords}
                        colors={[colors.primary]}
                        tintColor={colors.primary}
                      />
                    }
                  >
                    {cloudRecords.map((record) => (
                      <View
                        key={record.filename}
                        style={[
                          styles.recordItem,
                          { backgroundColor: colors.bgSurfaceHighest },
                          selectedRecords.has(record.filename) && {
                            borderColor: colors.primary,
                            borderWidth: 2
                          }
                        ]}
                      >
                        {isMultiSelectMode && (
                          <TouchableOpacity
                            style={[
                              styles.checkbox,
                              {
                                borderColor: colors.borderSubtle,
                                backgroundColor: selectedRecords.has(record.filename)
                                  ? colors.primary
                                  : 'transparent'
                              }
                            ]}
                            onPress={() => toggleRecordSelection(record.filename)}
                          >
                            {selectedRecords.has(record.filename) && (
                              <Text style={[styles.checkmark, { color: colors.textOnPrimary }]}>
                                ✓
                              </Text>
                            )}
                          </TouchableOpacity>
                        )}

                        {renamingRecord === record.filename ? (
                          <View style={styles.renameContainer}>
                            <TextInput
                              style={[
                                styles.renameInput,
                                {
                                  backgroundColor: colors.bgSurfaceNormal,
                                  color: colors.textPrimary,
                                  borderColor: colors.borderStrong
                                }
                              ]}
                              value={newRecordName}
                              onChangeText={setNewRecordName}
                              placeholder={t('data_sync.new_name_placeholder', '输入新名称')}
                              placeholderTextColor={colors.textSecondary}
                              autoFocus
                            />
                            <TouchableOpacity
                              style={[styles.renameConfirm, { backgroundColor: colors.primary }]}
                              onPress={() => handleRenameRecord(activeTargetId, record.filename)}
                            >
                              <Text
                                style={[styles.renameConfirmText, { color: colors.textOnPrimary }]}
                              >
                                {t('common.confirm', '确认')}
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.renameCancel}
                              onPress={() => {
                                setRenamingRecord(null)
                                setNewRecordName('')
                              }}
                            >
                              <Text
                                style={[styles.renameCancelText, { color: colors.textSecondary }]}
                              >
                                {t('common.cancel', '取消')}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <>
                            <View style={styles.recordInfo}>
                              <Text
                                style={[styles.recordName, { color: colors.textPrimary }]}
                                numberOfLines={1}
                              >
                                {record.filename}
                              </Text>
                              <Text style={[styles.recordMeta, { color: colors.textSecondary }]}>
                                {new Date(record.lastModified).toLocaleString()} ·{' '}
                                {formatSize(record.sizeInBytes)}
                                {record.managed && (
                                  <Text style={{ color: colors.primary }}>
                                    {' '}
                                    · {t('data_sync.managed', '受管')}
                                  </Text>
                                )}
                              </Text>
                            </View>

                            {!isMultiSelectMode && (
                              <View style={styles.recordActions}>
                                <TouchableOpacity
                                  style={[
                                    styles.recordAction,
                                    { backgroundColor: colors.primary + '20' }
                                  ]}
                                  onPress={() =>
                                    handleRestoreRecord(activeTargetId, record.filename)
                                  }
                                >
                                  <Text
                                    style={[styles.recordActionText, { color: colors.primary }]}
                                  >
                                    {t('data_sync.restore', '恢复')}
                                  </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={[
                                    styles.recordAction,
                                    { backgroundColor: colors.warning + '20' }
                                  ]}
                                  onPress={() => {
                                    setRenamingRecord(record.filename)
                                    setNewRecordName(record.filename)
                                  }}
                                >
                                  <Text
                                    style={[styles.recordActionText, { color: colors.warning }]}
                                  >
                                    {t('data_sync.rename', '重命名')}
                                  </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={[
                                    styles.recordAction,
                                    { backgroundColor: colors.error + '20' }
                                  ]}
                                  onPress={() =>
                                    handleDeleteCloudRecord(activeTargetId, record.filename)
                                  }
                                >
                                  <Text style={[styles.recordActionText, { color: colors.error }]}>
                                    {t('common.delete', '删除')}
                                  </Text>
                                </TouchableOpacity>
                              </View>
                            )}
                          </>
                        )}
                      </View>
                    ))}
                  </ScrollView>
                )}
              </View>
            )}
          </ScrollView>
        </View>
      </SafeAreaView>
    </>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1
  },
  container: {
    flex: 1
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1
  },
  backButton: {
    padding: 8
  },
  backText: {
    fontSize: 16,
    fontWeight: '600'
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700'
  },
  addButton: {
    fontSize: 16,
    fontWeight: '600'
  },
  content: {
    flex: 1,
    padding: 16
  },
  section: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12
  },
  quickActionButton: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    borderRadius: 12
  },
  quickActionIcon: {
    fontSize: 32,
    marginBottom: 8
  },
  quickActionText: {
    fontSize: 14,
    fontWeight: '600'
  },
  formGroup: {
    marginBottom: 16
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8
  },
  formInput: {
    height: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16
  },
  typeButtons: {
    flexDirection: 'row',
    gap: 8
  },
  typeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '600'
  },
  saveButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center'
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600'
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 24
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 12
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4
  },
  emptySubText: {
    fontSize: 14,
    textAlign: 'center'
  },
  targetItem: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12
  },
  targetInfo: {
    marginBottom: 12
  },
  targetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  targetName: {
    fontSize: 16,
    fontWeight: '600'
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600'
  },
  targetUrl: {
    fontSize: 14,
    marginBottom: 4
  },
  lastSync: {
    fontSize: 12
  },
  targetActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  syncButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8
  },
  syncButtonText: {
    fontSize: 14,
    fontWeight: '600'
  },
  deleteButton: {
    padding: 8
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: '600'
  },
  recordsButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8
  },
  recordsButtonText: {
    fontSize: 12,
    fontWeight: '600'
  },
  recordsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  recordsHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  multiSelectToggle: {
    fontSize: 14,
    fontWeight: '600'
  },
  closeRecordsButton: {
    fontSize: 18,
    fontWeight: '600',
    padding: 4
  },
  batchDeleteButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12
  },
  batchDeleteText: {
    fontSize: 14,
    fontWeight: '600'
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 24
  },
  loadingText: {
    fontSize: 14
  },
  recordsList: {
    maxHeight: 400
  },
  recordItem: {
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center'
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderRadius: 4,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  checkmark: {
    fontSize: 14,
    fontWeight: '700'
  },
  recordInfo: {
    flex: 1
  },
  recordName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2
  },
  recordMeta: {
    fontSize: 11
  },
  recordActions: {
    flexDirection: 'row',
    gap: 6,
    marginLeft: 8
  },
  recordAction: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6
  },
  recordActionText: {
    fontSize: 12,
    fontWeight: '600'
  },
  renameContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  renameInput: {
    flex: 1,
    height: 36,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 14
  },
  renameConfirm: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6
  },
  renameConfirmText: {
    fontSize: 13,
    fontWeight: '600'
  },
  renameCancel: {
    padding: 8
  },
  renameCancelText: {
    fontSize: 13,
    fontWeight: '600'
  }
})
