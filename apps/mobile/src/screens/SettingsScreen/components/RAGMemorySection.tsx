import React, { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Alert,
  TextInput
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '@baishou/ui/native'
import { useBaishou } from '../../../providers/BaishouProvider'
import {
  BATCH_EMBED_CONCURRENCY_MAX,
  BATCH_EMBED_CONCURRENCY_MIN,
  DEFAULT_BATCH_EMBED_CONCURRENCY
} from '@baishou/shared'

export const RAGMemorySection: React.FC = () => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const { services, dbReady } = useBaishou()

  const [ragConfig, setRagConfig] = useState<any>({})
  const [ragStats, setRagStats] = useState<any>({
    totalCount: 0,
    currentDimension: 0
  })
  const [isRagLoading, setIsRagLoading] = useState(false)
  const [ragProgress, setRagProgress] = useState<any>(null)
  const [ragEntries, setRagEntries] = useState<Array<{ embeddingId: string; text: string }>>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [manualMemoryText, setManualMemoryText] = useState('')

  const loadRagStats = useCallback(async () => {
    if (!services?.ragService || !dbReady) return
    try {
      setIsRagLoading(true)
      const stats = await services.ragService.getStats()
      const ragConfigData = (await services.settingsManager.get<any>('rag_config')) || {}
      setRagStats({
        totalCount: stats.totalCount,
        currentDimension: stats.currentDimension,
        totalSizeText: ragConfigData.totalSizeText || `${(stats.totalCount * 2.5).toFixed(1)} KB`
      })
      const res = await services.ragService.queryEntries({
        keyword: searchQuery || undefined,
        limit: 20,
        offset: 0,
        mode: searchQuery ? 'semantic' : 'text',
        withTotal: true
      })
      setRagEntries(
        res.entries.map((e) => ({
          embeddingId: String(e.embeddingId ?? ''),
          text: String(e.text ?? '').slice(0, 200)
        }))
      )
    } catch (e) {
      console.warn('Load RAG stats failed', e)
    } finally {
      setIsRagLoading(false)
    }
  }, [services, dbReady, searchQuery])

  useEffect(() => {
    if (!dbReady || !services) return
    const loadConfig = async () => {
      try {
        const ragConfigData = (await services.settingsManager.get<any>('rag_config')) || {}
        setRagConfig(ragConfigData)
      } catch (e) {
        console.warn('Load RAG config failed', e)
      }
    }
    loadConfig()
    loadRagStats()
  }, [dbReady, services, loadRagStats])

  const handleSaveRagConfig = async (config: any, options?: { silent?: boolean }) => {
    if (!services || !dbReady) return
    try {
      await services.settingsManager.set('rag_config', config)
      setRagConfig(config)
      if (!options?.silent) {
        Alert.alert(t('common.success'), t('settings.rag_saved'))
      }
    } catch (e) {
      Alert.alert(t('common.error'), t('common.errors.save_failed'))
    }
  }

  const handleDetectDimension = async () => {
    if (!services?.ragService || !dbReady) return
    try {
      setIsRagLoading(true)
      const globalModelsConfig = (await services.settingsManager.get<any>('global_models')) || {}
      if (
        !globalModelsConfig.globalEmbeddingProviderId ||
        !globalModelsConfig.globalEmbeddingModelId
      ) {
        Alert.alert(t('common.hint'), t('agent.rag.embedding_not_configured'))
        return
      }

      const dimension = await services.ragService.detectDimension()
      setRagStats((prev: any) => ({ ...prev, currentDimension: dimension }))
      Alert.alert(
        t('common.success'),
        t('agent.rag.detect_success').replace('${dimension}',
          dimension.toString()
        )
      )
    } catch (e: any) {
      Alert.alert(
        t('common.error'),
        e?.message || t('agent.rag.detect_failed')
      )
    } finally {
      setIsRagLoading(false)
    }
  }

  const handleBatchEmbed = async () => {
    if (!services?.ragService || !dbReady) return
    try {
      setIsRagLoading(true)
      setRagProgress({ current: 0, total: 0, status: 'starting' })

      const count = await services.ragService.batchEmbed((p) => {
        setRagProgress({
          current: p.current,
          total: p.total,
          status: p.status
        })
      })

      if (count === 0) {
        Alert.alert(t('common.hint'), t('agent.rag.no_memories_yet'))
        setRagProgress(null)
        return
      }

      setRagStats((prev: any) => ({ ...prev, totalCount: count }))
      setRagProgress(null)
      Alert.alert(
        t('common.success'),
        t('agent.rag.batch_embed_success').replace('$count',
          count.toString()
        )
      )
      await loadRagStats()
    } catch (e: any) {
      setRagProgress(null)
      Alert.alert(
        t('common.error'),
        e?.message || t('agent.rag.batch_embed_error')
      )
    } finally {
      setIsRagLoading(false)
    }
  }

  const handleClearMemory = async () => {
    if (!services?.ragService || !dbReady) return
    Alert.alert(
      t('agent.rag.clear_all_title'),
      t('agent.rag.clear_all_content'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          style: 'destructive',
          onPress: async () => {
            try {
              setIsRagLoading(true)
              await services.ragService.clearAll()
              setRagStats({ totalCount: 0, currentDimension: 0 })
              Alert.alert(
                t('common.success'),
                t('agent.rag.clear_dim_success')
              )
            } catch (e) {
              Alert.alert(
                t('common.error'),
                t('agent.rag.batch_embed_error')
              )
            } finally {
              setIsRagLoading(false)
            }
          }
        }
      ]
    )
  }

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
        {t('agent.rag.title')}
      </Text>
      <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>
        {t('settings.rag_subtitle')}
      </Text>

      <View style={[styles.settingItem, { backgroundColor: colors.bgSurfaceHighest }]}>
        <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>
          {t('agent.features.rag_enable')}
        </Text>
        <Switch
          value={ragConfig.ragEnabled || false}
          onValueChange={(value) => handleSaveRagConfig({ ...ragConfig, ragEnabled: value })}
        />
      </View>

      <View style={[styles.settingItem, { backgroundColor: colors.bgSurfaceHighest }]}>
        <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>
          {t('settings.rag_batch_embed_concurrency')}
        </Text>
        <Text style={[styles.settingHint, { color: colors.textSecondary }]}>
          {t('settings.rag_batch_embed_concurrency_hint')}
        </Text>
        <View style={styles.concurrencyRow}>
          {Array.from(
            { length: BATCH_EMBED_CONCURRENCY_MAX - BATCH_EMBED_CONCURRENCY_MIN + 1 },
            (_, i) => BATCH_EMBED_CONCURRENCY_MIN + i
          ).map((n) => {
            const selected =
              (ragConfig.batchEmbedConcurrency ?? DEFAULT_BATCH_EMBED_CONCURRENCY) === n
            return (
              <TouchableOpacity
                key={n}
                style={[
                  styles.concurrencyChip,
                  {
                    backgroundColor: selected ? colors.primary : colors.bgSurface,
                    borderColor: selected ? colors.primary : colors.borderSubtle
                  }
                ]}
                onPress={() =>
                  handleSaveRagConfig({ ...ragConfig, batchEmbedConcurrency: n }, { silent: true })
                }
              >
                <Text
                  style={{
                    color: selected ? colors.textOnPrimary : colors.textPrimary,
                    fontWeight: selected ? '700' : '400'
                  }}
                >
                  {n}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>
      </View>

      <View style={[styles.settingItem, { backgroundColor: colors.bgSurfaceHighest }]}>
        <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>
          {t('agent.rag.stat_total')}
        </Text>
        <Text style={[styles.settingValue, { color: colors.textSecondary }]}>
          {ragStats.totalCount || 0} {t('common.items_count')}
        </Text>
      </View>

      <View style={[styles.settingItem, { backgroundColor: colors.bgSurfaceHighest }]}>
        <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>
          {t('agent.rag.stat_dimension')}
        </Text>
        <Text style={[styles.settingValue, { color: colors.textSecondary }]}>
          {ragStats.currentDimension || t('agent.rag.dimension_not_configured')}
        </Text>
      </View>

      {ragProgress && (
        <View style={[styles.progressContainer, { backgroundColor: colors.bgSurface }]}>
          <Text style={[styles.progressText, { color: colors.textSecondary }]}>
            {ragProgress.status}
          </Text>
          <View style={[styles.progressBar, { backgroundColor: colors.borderSubtle }]}>
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: colors.primary,
                  width: `${ragProgress.total > 0 ? (ragProgress.current / ragProgress.total) * 100 : 0}%`
                }
              ]}
            />
          </View>
          <Text style={[styles.progressText, { color: colors.textSecondary }]}>
            {ragProgress.current} / {ragProgress.total}
          </Text>
        </View>
      )}

      <View style={[styles.settingItem, { backgroundColor: colors.bgSurfaceHighest }]}>
        <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>
          {t('agent.rag.action_add_memory')}
        </Text>
        <TextInput
          style={[
            styles.memoryInput,
            { color: colors.textPrimary, borderColor: colors.borderSubtle }
          ]}
          placeholder={t('agent.rag.add_memory_hint')}
          placeholderTextColor={colors.textSecondary}
          value={manualMemoryText}
          onChangeText={setManualMemoryText}
          multiline
        />
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.bgSurface, marginBottom: 0 }]}
          onPress={async () => {
            if (!manualMemoryText.trim() || !services?.ragService) return
            try {
              await services.ragService.addManualMemory(manualMemoryText.trim())
              setManualMemoryText('')
              await loadRagStats()
              Alert.alert(t('common.success'), t('agent.rag.add_memory_success'))
            } catch (e: unknown) {
              Alert.alert(
                t('common.error'),
                e instanceof Error ? e.message : t('agent.rag.add_manual_failed')
              )
            }
          }}
        >
          <Text style={{ color: colors.textPrimary }}>{t('common.add')}</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.actionButton, { backgroundColor: colors.primary }]}
        onPress={handleDetectDimension}
        disabled={isRagLoading}
      >
        {isRagLoading ? (
          <ActivityIndicator size="small" color={colors.textOnPrimary} />
        ) : (
          <Text style={[styles.actionButtonText, { color: colors.textOnPrimary }]}>
            {t('agent.rag.dimension_click_detect')}
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.actionButton, { backgroundColor: colors.bgSurfaceHighest }]}
        onPress={handleBatchEmbed}
        disabled={isRagLoading}
      >
        {isRagLoading ? (
          <ActivityIndicator size="small" color={colors.textPrimary} />
        ) : (
          <Text style={[styles.actionButtonText, { color: colors.textPrimary }]}>
            {t('agent.rag.action_batch_embed')}
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.actionButton, { backgroundColor: colors.error }]}
        onPress={handleClearMemory}
        disabled={isRagLoading}
      >
        <Text style={[styles.actionButtonText, { color: colors.textOnPrimary }]}>
          {t('agent.rag.clear_all')}
        </Text>
      </TouchableOpacity>

      {ragEntries.length > 0 && (
        <View style={[styles.entryList, { backgroundColor: colors.bgSurfaceHighest }]}>
          <Text style={[styles.entryListTitle, { color: colors.textSecondary }]}>
            {t('agent.rag.stat_total')} ({ragEntries.length})
          </Text>
          {ragEntries.slice(0, 10).map((entry) => (
            <View
              key={entry.embeddingId}
              style={[styles.entryRow, { borderBottomColor: colors.borderSubtle }]}
            >
              <Text style={[styles.entryText, { color: colors.textPrimary }]} numberOfLines={3}>
                {entry.text || entry.embeddingId}
              </Text>
              <TouchableOpacity
                onPress={async () => {
                  await services?.ragService.deleteEntry(entry.embeddingId)
                  await loadRagStats()
                }}
              >
                <Text style={{ color: colors.error, fontSize: 13 }}>
                  {t('common.delete')}
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 24
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1
  },
  sectionDescription: {
    fontSize: 14,
    marginBottom: 16
  },
  settingItem: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8
  },
  settingValue: {
    fontSize: 14
  },
  settingHint: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 10
  },
  concurrencyRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap'
  },
  concurrencyChip: {
    minWidth: 40,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center'
  },
  actionButton: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 12
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600'
  },
  progressContainer: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12
  },
  progressText: {
    fontSize: 14,
    marginBottom: 8
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8
  },
  progressFill: {
    height: '100%',
    borderRadius: 4
  },
  entryList: {
    borderRadius: 12,
    padding: 12,
    marginTop: 8
  },
  entryListTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase'
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  entryText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18
  },
  memoryInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    minHeight: 72,
    marginBottom: 10,
    fontSize: 14
  }
})
