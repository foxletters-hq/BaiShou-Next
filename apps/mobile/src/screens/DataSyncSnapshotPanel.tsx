import React, { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  ScrollView
} from 'react-native'
import { useTranslation } from 'react-i18next'
import type { SnapshotMeta } from '@baishou/core-mobile'
import {
  useNativeTheme,
  useNativeToast,
  useDialog,
  RestoreBlockingOverlay
} from '@baishou/ui/native'
import { useBaishou } from '../providers/BaishouProvider'
import { applyArchiveImportFeedback, isArchiveImportSuccessful } from '../utils/archive-restore-feedback'
import {
  parseSnapshotCreatedAtFromFilename,
  shouldRefreshVaultAfterArchiveImport
} from '../services/archive-guards.util'

const formatSnapshotTime = (item: { filename: string; createdAt: number }): string => {
  const parsed = parseSnapshotCreatedAtFromFilename(item.filename)
  const date = new Date(parsed ?? item.createdAt)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString()
}

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export const DataSyncSnapshotPanel: React.FC = () => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const toast = useNativeToast()
  const dialog = useDialog()
  const { services, dbReady, notifyArchiveRestoreComplete } = useBaishou()
  const archiveService = services?.archiveService

  const [snapshots, setSnapshots] = useState<SnapshotMeta[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)
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

  const handleRestore = (item: SnapshotMeta) => {
    if (!archiveService) return
    void (async () => {
      const confirmed = await dialog.confirm(t('data_sync.restore_warning'), {
        title: t('data_sync.confirm_restore'),
        confirmText: t('common.confirm'),
        destructive: true
      })
      if (!confirmed) return
      setIsRestoring(true)
      try {
        const result = await archiveService.restoreFromSnapshot(item.filename)
        applyArchiveImportFeedback(result, t, toast, (restored) => {
          if (shouldRefreshVaultAfterArchiveImport(restored)) {
            notifyArchiveRestoreComplete(restored)
          }
        })
        if (isArchiveImportSuccessful(result)) {
          void loadSnapshots()
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        toast.showError(msg || t('data_sync.restore_failed'))
      } finally {
        setIsRestoring(false)
      }
    })()
  }

  const handleDelete = (item: SnapshotMeta) => {
    if (!archiveService) return
    void (async () => {
      const confirmed = await dialog.confirm(item.filename, {
        title: t('common.confirm_delete'),
        confirmText: t('common.delete'),
        destructive: true
      })
      if (!confirmed) return
      await archiveService.deleteSnapshot(item.filename)
      await loadSnapshots()
      toast.showSuccess(t('common.delete_success'))
    })()
  }

  return (
    <>
      <RestoreBlockingOverlay visible={isRestoring} />
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
                    {formatSnapshotTime(item)} · {formatSize(item.size)}
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
    </>
  )
}

const styles = StyleSheet.create({
  section: { borderRadius: 12, padding: 16, marginBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  sectionTitle: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', marginBottom: 4 },
  hint: { fontSize: 12, lineHeight: 17 },
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
