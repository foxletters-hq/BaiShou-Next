import { useTranslation } from 'react-i18next'
import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  FlatList,
  ActivityIndicator
} from 'react-native'
import Slider from '@react-native-community/slider'
import { useNativeTheme } from '../theme'
import { Switch } from '../Switch'
import { Button } from '../Button'
import { SettingsSection } from '../SettingsSection'

export interface RagConfig {
  ragTopK: number
  ragSimilarityThreshold: number
  ragEnabled: boolean
}

export interface RagStats {
  totalCount: number
  currentDimension: number
  totalSizeText: string
}

export interface RagState {
  isRunning: boolean
  type: string
  progress: number
  total: number
  statusText: string
}

export interface RagEntry {
  embeddingId: string
  text: string
  modelId: string
  createdAt: number
  similarity?: number
}

export interface RagMemoryViewProps {
  config: RagConfig
  stats: RagStats
  ragState: RagState
  hasMismatchModel: boolean
  embeddingModelId?: string
  entries: RagEntry[]
  onChange: (config: RagConfig) => void
  onClearDimension?: () => Promise<void>
  onBatchEmbed?: () => Promise<void>
  onClearAll?: () => Promise<void>
  onDetectDimension?: () => Promise<void>
  onSearch?: (query: string, mode: string) => void
  onDeleteEntry?: (id: string) => Promise<void>
}

export const RagMemoryView: React.FC<RagMemoryViewProps> = ({
  config,
  stats,
  ragState,
  hasMismatchModel,
  embeddingModelId,
  entries,
  onChange,
  onClearDimension,
  onBatchEmbed,
  onClearAll,
  onDetectDimension,
  onSearch,
  onDeleteEntry
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchMode, setSearchMode] = useState<'semantic' | 'text'>('semantic')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleSearch = () => {
    if (onSearch && searchQuery.trim()) {
      onSearch(searchQuery.trim(), searchMode)
    }
  }

  const handleDelete = async (id: string) => {
    if (!onDeleteEntry) return
    setDeletingId(id)
    try {
      await onDeleteEntry(id)
    } finally {
      setDeletingId(null)
    }
  }

  const renderEntry = ({ item }: { item: RagEntry }) => (
    <View
      style={[
        styles.entryCard,
        {
          backgroundColor: colors.bgSurfaceNormal,
          borderColor: colors.borderSubtle
        }
      ]}
    >
      <View style={styles.entryHeader}>
        <Text style={[styles.entryModel, { color: colors.primary }]} numberOfLines={1}>
          {item.modelId}
        </Text>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => handleDelete(item.embeddingId)}
          disabled={deletingId === item.embeddingId}
        >
          {deletingId === item.embeddingId ? (
            <ActivityIndicator size="small" color={colors.error} />
          ) : (
            <Text style={[styles.deleteBtn, { color: colors.error }]}>
              {t('common.delete', '删除')}
            </Text>
          )}
        </TouchableOpacity>
      </View>
      <Text style={[styles.entryText, { color: colors.textPrimary }]} numberOfLines={3}>
        {item.text}
      </Text>
      <View style={styles.entryFooter}>
        <Text style={[styles.entryDate, { color: colors.textTertiary }]}>
          {new Date(item.createdAt).toLocaleDateString()}
        </Text>
        {item.similarity !== undefined && (
          <Text style={[styles.entrySimilarity, { color: colors.textSecondary }]}>
            Sim: {item.similarity.toFixed(3)}
          </Text>
        )}
      </View>
    </View>
  )

  const progressPercent =
    ragState.total > 0 ? Math.round((ragState.progress / ragState.total) * 100) : 0

  return (
    <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
      <SettingsSection title={t('rag.title', 'RAG 长期记忆')}>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
              {t('rag.enable', '启用 RAG')}
            </Text>
            <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
              {t('rag.enable_desc', '基于向量检索的长期记忆系统')}
            </Text>
          </View>
          <Switch
            value={config.ragEnabled}
            onValueChange={(v) => onChange({ ...config, ragEnabled: v })}
          />
        </View>

        <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />

        <View style={styles.statsRow}>
          <View
            style={[styles.statChip, { backgroundColor: colors.bgSurfaceNormal }]}
          >
            <Text style={[styles.statValue, { color: colors.textPrimary }]}>
              {stats.totalCount}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textTertiary }]}>
              {t('rag.total', '总条目')}
            </Text>
          </View>
          <View
            style={[styles.statChip, { backgroundColor: colors.bgSurfaceNormal }]}
          >
            <Text style={[styles.statValue, { color: colors.textPrimary }]}>
              {embeddingModelId ?? '-'}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textTertiary }]}>
              {t('rag.model', '模型')}
            </Text>
          </View>
          <View
            style={[styles.statChip, { backgroundColor: colors.bgSurfaceNormal }]}
          >
            <Text style={[styles.statValue, { color: colors.textPrimary }]}>
              {stats.currentDimension}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textTertiary }]}>
              {t('rag.dim', '维度')}
            </Text>
          </View>
        </View>

        {hasMismatchModel && (
          <View style={[styles.warningBox, { backgroundColor: colors.errorContainer }]}>
            <Text style={[styles.warningText, { color: colors.error }]}>
              {t('rag.mismatch_warning', '模型维度不匹配，请清除旧向量后重新嵌入')}
            </Text>
          </View>
        )}
      </SettingsSection>

      <SettingsSection title={t('rag.retrieval', '检索参数')}>
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>
            {t('rag.top_k', 'Top-K')}: {config.ragTopK}
          </Text>
          <Slider
            style={styles.slider}
            minimumValue={1}
            maximumValue={20}
            step={1}
            value={config.ragTopK}
            onValueChange={(v) => onChange({ ...config, ragTopK: Math.round(v) })}
            minimumTrackTintColor={colors.primary}
            maximumTrackTintColor={colors.borderMuted}
            thumbTintColor={colors.primary}
          />
        </View>

        <View style={[styles.fieldGroup, { borderTopColor: colors.borderSubtle }]}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>
            {t('rag.similarity_threshold', '相似度阈值')}:{' '}
            {config.ragSimilarityThreshold.toFixed(2)}
          </Text>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={1}
            step={0.01}
            value={config.ragSimilarityThreshold}
            onValueChange={(v) =>
              onChange({ ...config, ragSimilarityThreshold: Math.round(v * 100) / 100 })
            }
            minimumTrackTintColor={colors.primary}
            maximumTrackTintColor={colors.borderMuted}
            thumbTintColor={colors.primary}
          />
        </View>
      </SettingsSection>

      {ragState.isRunning && (
        <SettingsSection title={t('rag.progress', '任务进度')}>
          <View style={styles.progressBox}>
            <Text style={[styles.statusText, { color: colors.textPrimary }]}>
              {ragState.statusText}
            </Text>
            <View
              style={[styles.progressBar, { backgroundColor: colors.bgSurfaceNormal }]}
            >
              <View
                style={[
                  styles.progressFill,
                  {
                    backgroundColor: colors.primary,
                    width: `${progressPercent}%`
                  }
                ]}
              />
            </View>
            <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>
              {ragState.progress}/{ragState.total}
            </Text>
          </View>
        </SettingsSection>
      )}

      <View style={styles.actionRow}>
        {onBatchEmbed && (
          <Button
            variant="outlined"
            onPress={onBatchEmbed}
            disabled={ragState.isRunning}
            style={styles.actionBtn}
          >
            {t('rag.batch_embed', '全量嵌入')}
          </Button>
        )}
        {onClearAll && (
          <Button
            variant="outlined"
            onPress={onClearAll}
            disabled={ragState.isRunning}
            style={styles.actionBtn}
          >
            {t('rag.clear_all', '清空全部')}
          </Button>
        )}
      </View>

      <View style={styles.actionRow}>
        {onClearDimension && (
          <Button
            variant="text"
            onPress={onClearDimension}
            disabled={ragState.isRunning}
            style={styles.actionBtn}
          >
            {t('rag.clear_dimension', '清除维度')}
          </Button>
        )}
        {onDetectDimension && (
          <Button
            variant="text"
            onPress={onDetectDimension}
            disabled={ragState.isRunning}
            style={styles.actionBtn}
          >
            {t('rag.detect_dimension', '检测维度')}
          </Button>
        )}
      </View>

      {onSearch && (
        <SettingsSection title={t('rag.search', '记忆搜索')}>
          <View style={styles.searchRow}>
            <TextInput
              style={[
                styles.searchInput,
                {
                  backgroundColor: colors.bgSurfaceNormal,
                  color: colors.textPrimary,
                  borderColor: colors.borderMuted
                }
              ]}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t('rag.search_placeholder', '输入搜索关键词')}
              placeholderTextColor={colors.textTertiary}
              returnKeyType="search"
              onSubmitEditing={handleSearch}
            />
            <Button onPress={handleSearch} disabled={!searchQuery.trim()}>
              {t('common.search', '搜索')}
            </Button>
          </View>
          <View style={styles.modeRow}>
            <TouchableOpacity
              activeOpacity={0.7}
              style={[
                styles.modeChip,
                {
                  borderColor:
                    searchMode === 'semantic' ? colors.primary : colors.borderMuted,
                  backgroundColor:
                    searchMode === 'semantic' ? colors.primaryLight : 'transparent'
                }
              ]}
              onPress={() => setSearchMode('semantic')}
            >
              <Text
                style={[
                  styles.modeText,
                  {
                    color:
                      searchMode === 'semantic' ? colors.primary : colors.textSecondary
                  }
                ]}
              >
                {t('rag.semantic', '语义')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.7}
              style={[
                styles.modeChip,
                {
                  borderColor:
                    searchMode === 'text' ? colors.primary : colors.borderMuted,
                  backgroundColor:
                    searchMode === 'text' ? colors.primaryLight : 'transparent'
                }
              ]}
              onPress={() => setSearchMode('text')}
            >
              <Text
                style={[
                  styles.modeText,
                  {
                    color:
                      searchMode === 'text' ? colors.primary : colors.textSecondary
                  }
                ]}
              >
                {t('rag.text', '文本')}
              </Text>
            </TouchableOpacity>
          </View>
        </SettingsSection>
      )}

      {entries.length > 0 && (
        <SettingsSection title={t('rag.entries', '记忆条目')}>
          {entries.map((item) => (
            <View key={item.embeddingId}>{renderEntry({ item })}</View>
          ))}
        </SettingsSection>
      )}

      <View style={styles.bottomSpacer} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14
  },
  rowText: { flex: 1, marginRight: 12 },
  rowTitle: { fontSize: 15, fontWeight: '500' },
  rowSubtitle: { fontSize: 13, marginTop: 2 },
  divider: { height: 1 },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  statChip: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center'
  },
  statValue: { fontSize: 16, fontWeight: '600' },
  statLabel: { fontSize: 11, marginTop: 2 },
  warningBox: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 8,
    padding: 10
  },
  warningText: { fontSize: 13, fontWeight: '500' },
  fieldGroup: {
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  label: { fontSize: 14, fontWeight: '500', marginBottom: 4 },
  slider: { width: '100%', height: 40 },
  progressBox: {
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  statusText: { fontSize: 14, fontWeight: '500', marginBottom: 8 },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden'
  },
  progressFill: {
    height: '100%',
    borderRadius: 4
  },
  progressLabel: { fontSize: 12, marginTop: 6, textAlign: 'right' },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 8
  },
  actionBtn: { flex: 1 },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center'
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12
  },
  modeChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1
  },
  modeText: { fontSize: 13, fontWeight: '500' },
  entryCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginHorizontal: 16,
    marginVertical: 4
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  entryModel: { fontSize: 12, fontWeight: '600', flex: 1 },
  deleteBtn: { fontSize: 13, fontWeight: '500' },
  entryText: { fontSize: 13, lineHeight: 18, marginBottom: 6 },
  entryFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  entryDate: { fontSize: 11 },
  entrySimilarity: { fontSize: 11 },
  bottomSpacer: { height: 40 }
})
