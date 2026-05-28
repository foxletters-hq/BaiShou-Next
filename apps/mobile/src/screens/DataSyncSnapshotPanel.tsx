import React, { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  ScrollView
} from 'react-native'
import { useTranslation } from 'react-i18next'
import type { SnapshotMeta } from '@baishou/core-mobile'
import { useNativeTheme } from '@baishou/ui/native'
import { useBaishou } from '../providers/BaishouProvider'

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export const DataSyncSnapshotPanel: React.FC = () => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const { services, dbReady } = useBaishou()
  const archiveService = services?.archiveService

  const [snapshots, setSnapshots] = useState<SnapshotMeta[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [creating, setCreating] = useState(false)

  const loadSnapshots = useCallback(async () => {
    if (!archiveService) return
    setLoading(true)
    try {
      const list = await archiveService.listSnapshots()
      setSnapshots(list)
    } finally {
      setLoading(false)
    }
  }, [archiveService])

  useEffect(() => {
    if (!dbReady || !archiveService) return
    void loadSnapshots()
  }, [archiveService, dbReady, loadSnapshots])

  const onRefresh = async () => {
    setRefreshing(true)
    await loadSnapshots()
    setRefreshing(false)
  }

  const handleCreate = () => {
    if (!archiveService) return
    Alert.alert(
      t('storage.create_snapshot'),
      t('storage.create_snapshot_desc'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          onPress: async () => {
            setCreating(true)
            try {
              const path = await archiveService.createSnapshot()
              if (path) {
                Alert.alert(t('common.success'), t('storage.snapshot_created'))
                await loadSnapshots()
              } else {
                Alert.alert(t('common.error'), t('data_sync.backup_failed'))
              }
            } catch {
              Alert.alert(t('common.error'), t('data_sync.backup_failed'))
            } finally {
              setCreating(false)
            }
          }
        }
      ]
    )
  }

  const handleRestore = (item: SnapshotMeta) => {
    if (!archiveService) return
    Alert.alert(
      t('data_sync.confirm_restore'),
      t('data_sync.restore_warning'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          style: 'destructive',
          onPress: async () => {
            try {
              await archiveService.restoreFromSnapshot(item.filename)
              Alert.alert(t('common.success'), t('data_sync.restore_success'))
            } catch (e: unknown) {
              const msg = e instanceof Error ? e.message : String(e)
              Alert.alert(t('common.error'), msg || t('data_sync.restore_failed'))
            }
          }
        }
      ]
    )
  }

  const handleDelete = (item: SnapshotMeta) => {
    if (!archiveService) return
    Alert.alert(t('common.confirm_delete'), item.filename, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await archiveService.deleteSnapshot(item.filename)
          await loadSnapshots()
        }
      }
    ])
  }

  return (
    <View style={[styles.section, { backgroundColor: colors.bgSurface }]}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            {t('data_sync.local_snapshots')}
          </Text>
          <Text style={[styles.hint, { color: colors.textTertiary }]}>
            {t('data_sync.snapshots_scope_hint')}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.createBtn, { backgroundColor: colors.primary }]}
          onPress={handleCreate}
          disabled={creating}
        >
          {creating ? (
            <ActivityIndicator color={colors.textOnPrimary} size="small" />
          ) : (
            <Text style={{ color: colors.textOnPrimary, fontWeight: '600', fontSize: 13 }}>
              {t('storage.create_snapshot')}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        nestedScrollEnabled
      >
        {loading && snapshots.length === 0 ? (
          <Text style={[styles.empty, { color: colors.textSecondary }]}>
            {t('data_sync.loading_snapshots')}
          </Text>
        ) : snapshots.length === 0 ? (
          <Text style={[styles.empty, { color: colors.textSecondary }]}>
            {t('data_sync.no_snapshots_hint')}
          </Text>
        ) : (
          snapshots.map((item) => (
            <View
              key={item.filename}
              style={[styles.row, { borderBottomColor: colors.borderSubtle }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
                  {item.filename}
                </Text>
                <Text style={[styles.meta, { color: colors.textSecondary }]}>
                  {new Date(item.createdAt).toLocaleString()} · {formatSize(item.size)}
                </Text>
              </View>
              <TouchableOpacity onPress={() => handleRestore(item)} style={styles.actionBtn}>
                <Text style={{ color: colors.primary }}>{t('data_sync.restore')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(item)} style={styles.actionBtn}>
                <Text style={{ color: colors.error }}>{t('common.delete')}</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  section: { borderRadius: 12, padding: 16, marginBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  sectionTitle: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', marginBottom: 4 },
  hint: { fontSize: 12, lineHeight: 17 },
  createBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, minWidth: 88, alignItems: 'center' },
  empty: { paddingVertical: 24, textAlign: 'center', fontSize: 14 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  name: { fontSize: 14, fontWeight: '500', marginBottom: 4 },
  meta: { fontSize: 12 },
  actionBtn: { paddingHorizontal: 8, paddingVertical: 4 }
})
