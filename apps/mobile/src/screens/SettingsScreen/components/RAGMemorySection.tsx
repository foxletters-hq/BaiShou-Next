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

  const handleSaveRagConfig = async (config: any) => {
    if (!services || !dbReady) return
    try {
      await services.settingsManager.set('rag_config', config)
      setRagConfig(config)
      Alert.alert(t('common.success', '成功'), t('settings.rag_saved', 'RAG配置已保存'))
    } catch (e) {
      Alert.alert(t('common.error', '错误'), t('settings.save_failed', '保存失败'))
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
        Alert.alert(t('common.hint', '提示'), t('settings.no_embedding_model', '请先配置嵌入模型'))
        return
      }

      const dimension = await services.ragService.detectDimension()
      setRagStats((prev: any) => ({ ...prev, currentDimension: dimension }))
      Alert.alert(
        t('common.success', '成功'),
        t('settings.dimension_detected', '维度检测完成: {dimension}').replace(
          '{dimension}',
          dimension.toString()
        )
      )
    } catch (e: any) {
      Alert.alert(
        t('common.error', '错误'),
        e?.message || t('settings.detect_failed', '维度检测失败')
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
        Alert.alert(t('common.hint', '提示'), t('settings.no_diaries_to_embed', '没有可嵌入的日记'))
        setRagProgress(null)
        return
      }

      setRagStats((prev: any) => ({ ...prev, totalCount: count }))
      setRagProgress(null)
      Alert.alert(
        t('common.success', '成功'),
        t('settings.batch_embed_completed', '批量嵌入完成: {count} 条').replace(
          '{count}',
          count.toString()
        )
      )
      await loadRagStats()
    } catch (e: any) {
      setRagProgress(null)
      Alert.alert(
        t('common.error', '错误'),
        e?.message || t('settings.batch_embed_failed', '批量嵌入失败')
      )
    } finally {
      setIsRagLoading(false)
    }
  }

  const handleClearMemory = async () => {
    if (!services?.ragService || !dbReady) return
    Alert.alert(
      t('settings.clear_memory_confirm_title', '确认清空'),
      t(
        'settings.clear_memory_confirm_message',
        '此操作将清空所有RAG记忆数据，不可恢复。确定继续吗？'
      ),
      [
        { text: t('common.cancel', '取消'), style: 'cancel' },
        {
          text: t('common.confirm', '确定'),
          style: 'destructive',
          onPress: async () => {
            try {
              setIsRagLoading(true)
              await services.ragService.clearAll()
              setRagStats({ totalCount: 0, currentDimension: 0 })
              Alert.alert(
                t('common.success', '成功'),
                t('settings.memory_cleared', 'RAG记忆已清空')
              )
            } catch (e) {
              Alert.alert(
                t('common.error', '错误'),
                t('settings.clear_memory_failed', '清空记忆失败')
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
        {t('settings.rag_title', 'RAG 记忆管理')}
      </Text>
      <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>
        {t('settings.rag_desc', '管理向量记忆和RAG配置')}
      </Text>

      <View style={[styles.settingItem, { backgroundColor: colors.bgSurfaceHighest }]}>
        <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>
          {t('settings.rag_enabled', '启用 RAG')}
        </Text>
        <Switch
          value={ragConfig.ragEnabled || false}
          onValueChange={(value) => handleSaveRagConfig({ ...ragConfig, ragEnabled: value })}
        />
      </View>

      <View style={[styles.settingItem, { backgroundColor: colors.bgSurfaceHighest }]}>
        <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>
          {t('settings.embedding_count', '嵌入数量')}
        </Text>
        <Text style={[styles.settingValue, { color: colors.textSecondary }]}>
          {ragStats.totalCount || 0} {t('settings.count_unit', '个')}
        </Text>
      </View>

      <View style={[styles.settingItem, { backgroundColor: colors.bgSurfaceHighest }]}>
        <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>
          {t('settings.rag_dimension', '向量维度')}
        </Text>
        <Text style={[styles.settingValue, { color: colors.textSecondary }]}>
          {ragStats.currentDimension || t('settings.not_detected', '未检测')}
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
          {t('settings.add_manual_memory', '手动添加记忆')}
        </Text>
        <TextInput
          style={[
            styles.memoryInput,
            { color: colors.textPrimary, borderColor: colors.borderSubtle }
          ]}
          placeholder={t('settings.manual_memory_placeholder', '输入要记住的内容...')}
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
              Alert.alert(t('common.success', '成功'), t('settings.memory_added', '已添加记忆'))
            } catch (e: unknown) {
              Alert.alert(
                t('common.error', '错误'),
                e instanceof Error ? e.message : t('settings.memory_add_failed', '添加失败')
              )
            }
          }}
        >
          <Text style={{ color: colors.textPrimary }}>{t('settings.add_memory', '添加')}</Text>
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
            {t('settings.detect_dimension', '检测维度')}
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
            {t('settings.batch_embed', '批量嵌入')}
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.actionButton, { backgroundColor: colors.error }]}
        onPress={handleClearMemory}
        disabled={isRagLoading}
      >
        <Text style={[styles.actionButtonText, { color: colors.textOnPrimary }]}>
          {t('settings.clear_memory', '清空记忆')}
        </Text>
      </TouchableOpacity>

      {ragEntries.length > 0 && (
        <View style={[styles.entryList, { backgroundColor: colors.bgSurfaceHighest }]}>
          <Text style={[styles.entryListTitle, { color: colors.textSecondary }]}>
            {t('settings.rag_entries', '记忆条目')} ({ragEntries.length})
          </Text>
          {ragEntries.slice(0, 10).map((entry) => (
            <View key={entry.embeddingId} style={styles.entryRow}>
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
                  {t('common.delete', '删除')}
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,128,128,0.2)'
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
