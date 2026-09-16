import i18n from 'i18next'
import React, { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Pressable,
  ScrollView,
  useWindowDimensions
} from 'react-native'
import { useTranslation } from 'react-i18next'
import {
  buildRagEntryListPreview,
  formatRagEntryTimestamp,
  isGraphNodeRagEntry,
  isRagEntryEditable,
  ragVectorKindLabelKey,
  resolveRagMemoryEmptyCopy,
  resolveRagVectorKind,
  splitTextByKeyword,
  type RagVectorKind,
  type RagVectorKindFilter
} from '@baishou/shared'
import { Button } from '../Button'
import { Modal } from '../Modal/Modal'
import { useNativeTheme } from '../theme'
import { Pagination as RagPagination } from '../Pagination'
import { PageSizeSelector } from '../PageSizeSelector'
import type { RagEntry } from './rag-memory.types'
import { RAG_PAGE_SIZE_OPTIONS } from './rag-memory.types'
import { ragMemoryStyles as styles } from './rag-memory.styles'

interface RagMemoryEntryCardProps {
  item: RagEntry
  searchQuery?: string
  showSimilarity?: boolean
  activeMenuId: string | null
  setActiveMenuId: (id: string | null) => void
  onDelete?: (id: string) => Promise<void>
  onEdit?: (entry: RagEntry) => Promise<void>
}

export const RagMemoryEntryCard: React.FC<RagMemoryEntryCardProps> = ({
  item,
  searchQuery = '',
  showSimilarity = false,
  activeMenuId,
  setActiveMenuId,
  onDelete,
  onEdit
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const [deleting, setDeleting] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const menuOpen = activeMenuId === item.embeddingId
  const keyword = searchQuery.trim()
  const { preview } = buildRagEntryListPreview(item.text, keyword || undefined)

  const openPreview = () => {
    setActiveMenuId(null)
    setPreviewOpen(true)
  }

  const handleDelete = async () => {
    if (!onDelete) return
    setActiveMenuId(null)
    setDeleting(true)
    try {
      await onDelete(item.embeddingId)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <View
      style={[
        styles.entryCard,
        {
          backgroundColor: colors.bgSurfaceHigh,
          borderColor: colors.borderSubtle
        }
      ]}
    >
      <View style={styles.entryIconBlock}>
        <Text style={[styles.entryBraces, { color: colors.primary }]}>{'{ }'}</Text>
      </View>

      <View style={styles.entryContent}>
        {menuOpen && <Pressable style={styles.menuOverlay} onPress={() => setActiveMenuId(null)} />}
        <View style={styles.entryHeader}>
          <Text style={[styles.entryModel, { color: colors.primary }]} numberOfLines={1}>
            {item.modelId || '—'}
          </Text>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setActiveMenuId(menuOpen ? null : item.embeddingId)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={{ color: colors.textSecondary, fontSize: 18, fontWeight: '600' }}>⋮</Text>
          </TouchableOpacity>
        </View>
        {menuOpen && (
          <View
            style={[
              styles.entryMenu,
              { backgroundColor: colors.bgSurface, borderColor: colors.borderSubtle }
            ]}
          >
            <TouchableOpacity style={styles.menuItem} onPress={openPreview}>
              <Text style={{ color: colors.textPrimary }}>
                {t('settings.rag_view_entry', '查看完整片段')}
              </Text>
            </TouchableOpacity>
            {/* 日记切片不给编辑：正文才是事实来源，改切片不会回写日记 */}
            {onEdit && isRagEntryEditable(item.sourceType) && (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setActiveMenuId(null)
                  void onEdit(item)
                }}
              >
                <Text style={{ color: colors.textPrimary }}>{t('common.edit')}</Text>
              </TouchableOpacity>
            )}
            {onDelete && (
              <TouchableOpacity style={styles.menuItem} onPress={() => void handleDelete()}>
                {deleting ? (
                  <ActivityIndicator size="small" color={colors.error} />
                ) : (
                  <Text style={{ color: colors.error }}>
                    {isGraphNodeRagEntry(item.sourceType)
                      ? t('settings.rag_clear_node_embed', '清除节点向量')
                      : t('common.delete')}
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}
        {(() => {
          const kind = resolveRagVectorKind(item)
          if (!kind) return null
          const badge = kindBadgeStyle(kind, colors)
          return (
            <View style={styles.entryMetaRow}>
              <Text
                style={[
                  styles.entryMetaBadge,
                  { color: badge.color, backgroundColor: badge.backgroundColor }
                ]}
              >
                {t(ragVectorKindLabelKey(kind), kindFallback[kind])}
              </Text>
            </View>
          )
        })()}
        <TouchableOpacity activeOpacity={0.7} onPress={openPreview}>
          <Text style={[styles.entryText, { color: colors.textPrimary }]} numberOfLines={4}>
            {splitTextByKeyword(preview, keyword || undefined).map((part, index) => (
              <Text
                key={`${part.kind}-${index}`}
                style={
                  part.kind === 'mark'
                    ? { backgroundColor: 'rgba(91, 168, 245, 0.22)', color: colors.textPrimary }
                    : undefined
                }
              >
                {part.value}
              </Text>
            ))}
          </Text>
        </TouchableOpacity>
        <Button variant="outlined" onPress={openPreview}>
          {t('settings.rag_view_entry', '查看完整片段')}
        </Button>
        <View style={styles.entryMetaRow}>
          {item.tags && item.tags.length > 0
            ? item.tags.map((tag) => (
                <Text key={tag} style={[styles.entryTag, { color: colors.textTertiary }]}>
                  {tag}
                </Text>
              ))
            : null}
        </View>
        <View style={styles.entryFooter}>
          <Text style={[styles.entryDate, { color: colors.textTertiary }]}>
            {formatRagEntryTimestamp(item.createdAt, item.sourceType)}
          </Text>
          {item.memoryUpdatedAt != null && item.memoryUpdatedAt !== item.memoryCreatedAt ? (
            <Text style={[styles.entryDate, { color: colors.textTertiary }]}>
              {t('settings.rag_updated_at', '修改')}{' '}
              {formatRagEntryTimestamp(item.memoryUpdatedAt, item.sourceType)}
            </Text>
          ) : null}
          {showSimilarity && item.similarity !== undefined && (
            <View style={[styles.entrySimilarity, { backgroundColor: colors.primaryLight }]}>
              <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '600' }}>
                {(item.similarity * 100).toFixed(0)}%
              </Text>
            </View>
          )}
        </View>
      </View>
      <Modal
        visible={previewOpen}
        title={t('settings.rag_view_entry_title', '记忆片段')}
        onClose={() => setPreviewOpen(false)}
      >
        <ScrollView style={styles.entryPreviewScroll}>
          <Text style={[styles.entryPreviewText, { color: colors.textPrimary }]}>
            {splitTextByKeyword(item.text, keyword || undefined).map((part, index) => (
              <Text
                key={`${part.kind}-${index}`}
                style={
                  part.kind === 'mark'
                    ? { backgroundColor: 'rgba(91, 168, 245, 0.22)', color: colors.textPrimary }
                    : undefined
                }
              >
                {part.value}
              </Text>
            ))}
          </Text>
        </ScrollView>
        <TouchableOpacity
          style={styles.entryPreviewClose}
          onPress={() => setPreviewOpen(false)}
          activeOpacity={0.7}
        >
          <Text style={{ color: colors.primary, fontWeight: '600' }}>
            {t('common.close', '关闭')}
          </Text>
        </TouchableOpacity>
      </Modal>
    </View>
  )
}

const kindFallback: Record<RagVectorKind, string> = {
  diary: i18n.t('auto.packages.ui.src.native.RagMemoryView.RagMemoryEntryCard.L244', '日记'),
  partner: i18n.t('auto.packages.ui.src.native.RagMemoryView.RagMemoryEntryCard.L245', '伙伴'),
  manual: i18n.t('auto.packages.ui.src.native.RagMemoryView.RagMemoryEntryCard.L246', '手动'),
  graph_node: i18n.t('auto.packages.ui.src.native.RagMemoryView.RagMemoryEntryCard.L247', '节点')
}

function kindBadgeStyle(
  kind: RagVectorKind,
  colors: { primary: string; success: string }
): { color: string; backgroundColor: string } {
  if (kind === 'diary')
    return { color: colors.primary, backgroundColor: 'rgba(91, 168, 245, 0.14)' }
  if (kind === 'partner')
    return { color: colors.success, backgroundColor: 'rgba(16, 185, 129, 0.14)' }
  if (kind === 'manual') return { color: '#b45309', backgroundColor: 'rgba(245, 158, 11, 0.16)' }
  return { color: '#7c3aed', backgroundColor: 'rgba(124, 58, 237, 0.12)' }
}

interface RagMemoryEntriesSectionProps {
  entries: RagEntry[]
  searchQuery?: string
  searchMode?: 'semantic' | 'text'
  sourceKind?: RagVectorKindFilter
  totalCount?: number
  currentPage?: number
  pageSize?: number
  isSearching?: boolean
  onDeleteEntry?: (id: string) => Promise<void>
  onEditEntry?: (entry: RagEntry) => Promise<void>
  onPageChange?: (page: number, pageSize: number) => void
}

export const RagMemoryEntriesSection: React.FC<RagMemoryEntriesSectionProps> = ({
  entries,
  searchQuery = '',
  searchMode = 'text',
  sourceKind = 'all',
  totalCount = 0,
  currentPage = 1,
  pageSize = 10,
  isSearching = false,
  onDeleteEntry,
  onEditEntry,
  onPageChange
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const { width } = useWindowDimensions()
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null)

  const effectiveTotal = totalCount > 0 ? totalCount : entries.length
  const totalPages = Math.max(1, Math.ceil(effectiveTotal / pageSize))
  const safeCurrentPage = Math.min(Math.max(currentPage, 1), totalPages)
  const showPagination = effectiveTotal > pageSize
  const showSimilarity = searchMode === 'semantic' && searchQuery.trim().length > 0
  const paginationInfo = t('settings.rag_pagination_info').replace('$total', String(effectiveTotal))
  const emptyCopy = resolveRagMemoryEmptyCopy({ searchQuery, sourceKind })

  if (isSearching) {
    return (
      <View style={styles.searchingBox} accessibilityRole="progressbar">
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={[styles.paginationInfo, { color: colors.textSecondary, marginTop: 12 }]}>
          {t('settings.rag_searching', '正在搜索…')}
        </Text>
      </View>
    )
  }

  return (
    <View>
      {entries.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={[styles.paginationInfo, { color: colors.textSecondary }]}>
            {t(emptyCopy.titleKey, emptyCopy.titleFallback)}
          </Text>
          <Text style={[styles.paginationInfo, { color: colors.textTertiary, marginTop: 8 }]}>
            {t(emptyCopy.descKey, emptyCopy.descFallback)}
          </Text>
        </View>
      ) : (
        entries.map((item) => (
          <RagMemoryEntryCard
            key={item.embeddingId}
            item={item}
            searchQuery={searchQuery}
            showSimilarity={showSimilarity}
            activeMenuId={activeMenuId}
            setActiveMenuId={setActiveMenuId}
            onDelete={onDeleteEntry}
            onEdit={onEditEntry}
          />
        ))
      )}

      {showPagination && onPageChange ? (
        <View style={[styles.paginationRow, { borderTopColor: colors.borderSubtle }]}>
          <View style={styles.paginationMetaRow}>
            <Text style={[styles.paginationInfo, { color: colors.textTertiary }]} numberOfLines={1}>
              {paginationInfo}
            </Text>
            <PageSizeSelector
              value={pageSize}
              options={[...RAG_PAGE_SIZE_OPTIONS]}
              label={t('settings.rag_per_page', '条/页')}
              onChange={(size) => onPageChange(1, size)}
            />
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            bounces={false}
            style={styles.paginationNavScroll}
            contentContainerStyle={styles.paginationNavContent}
          >
            <RagPagination
              current={safeCurrentPage}
              total={totalPages}
              onChange={(page) => onPageChange(page, pageSize)}
              siblingCount={width >= 400 ? 1 : 0}
              showJumper
            />
          </ScrollView>
        </View>
      ) : null}
    </View>
  )
}
