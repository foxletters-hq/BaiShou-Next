import i18n from 'i18next'
import React, { useRef, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  useWindowDimensions
} from 'react-native'
import { useTranslation } from 'react-i18next'
import {
  buildRagEntryListPreview,
  formatRagEntryTimestamp,
  splitGraphNodeCardText,
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
import { Card } from '../Card'
import { ContextMenu } from '../ContextMenu'
import { Modal, modalActionsStyle } from '../Modal/Modal'
import { useNativeTheme } from '../theme'
import { Pagination as RagPagination } from '../Pagination'
import { PageSizeSelector } from '../PageSizeSelector'
import type { RagEntry } from './rag-memory.types'
import { RAG_PAGE_SIZE_OPTIONS } from './rag-memory.types'
import { ragMemoryStyles as styles } from './rag-memory.styles'
import { sharedTokens } from '../../theme/tokens'

interface RagMemoryEntryCardProps {
  item: RagEntry
  searchQuery?: string
  showSimilarity?: boolean
  activeMenuId: string | null
  setActiveMenuId: (id: string | null) => void
  onDelete?: (id: string) => Promise<void>
  onEdit?: (entry: RagEntry) => Promise<void>
}

export const RagMemoryEntryCard: React.FC<RagMemoryEntryCardProps> = React.memo(
  ({
    item,
    searchQuery = '',
    showSimilarity = false,
    activeMenuId,
    setActiveMenuId,
    onDelete,
    onEdit
  }) => {
    const { t } = useTranslation()
    const { colors, tokens } = useNativeTheme()
    const [previewOpen, setPreviewOpen] = useState(false)
    const [menuTriggerLayout, setMenuTriggerLayout] = useState({ x: 0, y: 0, width: 0, height: 0 })
    const menuTriggerRef = useRef<View>(null)
    const menuOpen = activeMenuId === item.embeddingId
    const keyword = searchQuery.trim()
    const { preview } = buildRagEntryListPreview(item.text, keyword || undefined)
    const nodeCard = isGraphNodeRagEntry(item.sourceType) ? splitGraphNodeCardText(item.text) : null

    const openPreview = () => {
      setActiveMenuId(null)
      setPreviewOpen(true)
    }

    const handleDelete = async () => {
      if (!onDelete) return
      setActiveMenuId(null)
      await onDelete(item.embeddingId)
    }

    return (
      <Card
        style={{
          marginBottom: tokens.spacing.sm,
          backgroundColor: colors.bgSurface,
          borderColor: colors.borderMuted
        }}
      >
        <View style={styles.entryContent}>
          <View style={styles.entryHeader}>
            <Text style={[styles.entryModel, { color: colors.textSecondary }]} numberOfLines={1}>
              {item.modelId || '—'}
            </Text>
            {(() => {
              const kind = resolveRagVectorKind(item)
              if (!kind) return null
              const badge = kindBadgeStyle(kind, colors)
              return (
                <View style={[styles.entryKindBadge, { backgroundColor: badge.backgroundColor }]}>
                  <Text style={[styles.entryKindBadgeText, { color: badge.color }]}>
                    {t(ragVectorKindLabelKey(kind), kindFallback[kind])}
                  </Text>
                </View>
              )
            })()}
            <View ref={menuTriggerRef} collapsable={false}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                  menuTriggerRef.current?.measureInWindow((x, y, width, height) => {
                    setMenuTriggerLayout({ x, y, width, height })
                    setActiveMenuId(menuOpen ? null : item.embeddingId)
                  })
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel={t('common.more', '更多')}
              >
                <Text style={[styles.entryMenuTrigger, { color: colors.textSecondary }]}>⋮</Text>
              </TouchableOpacity>
            </View>
          </View>
          <ContextMenu
            visible={menuOpen}
            onClose={() => setActiveMenuId(null)}
            triggerLayout={menuTriggerLayout}
            items={[
              {
                label: t('settings.rag_view_entry', '查看完整片段'),
                onPress: openPreview
              },
              ...(onEdit && isRagEntryEditable(item.sourceType)
                ? [
                    {
                      label: t('common.edit'),
                      onPress: () => {
                        void onEdit(item)
                      }
                    }
                  ]
                : []),
              ...(onDelete
                ? [
                    {
                      label: isGraphNodeRagEntry(item.sourceType)
                        ? t('settings.rag_clear_node_embed', '清除节点向量')
                        : t('common.delete'),
                      destructive: true,
                      onPress: () => {
                        void handleDelete()
                      }
                    }
                  ]
                : [])
            ]}
          />
          <TouchableOpacity activeOpacity={0.7} onPress={openPreview}>
            {nodeCard ? (
              <View>
                <Text
                  style={[styles.entryNodeLine, { color: colors.textPrimary }]}
                  numberOfLines={2}
                >
                  <Text style={{ color: colors.textSecondary }}>
                    {t('settings.rag_node_name', '节点名称')}{' '}
                  </Text>
                  {nodeCard.name}
                </Text>
                <Text
                  style={[styles.entryNodeLine, { color: colors.textPrimary }]}
                  numberOfLines={2}
                >
                  <Text style={{ color: colors.textSecondary }}>
                    {t('settings.rag_node_summary', '摘要')}{' '}
                  </Text>
                  <Text style={nodeCard.summary ? undefined : { color: colors.textTertiary }}>
                    {nodeCard.summary || t('settings.rag_node_summary_empty', '无')}
                  </Text>
                </Text>
              </View>
            ) : (
              <Text style={[styles.entryText, { color: colors.textPrimary }]} numberOfLines={4}>
                {splitTextByKeyword(preview, keyword || undefined).map((part, index) => (
                  <Text
                    key={`${part.kind}-${index}`}
                    style={
                      part.kind === 'mark'
                        ? { backgroundColor: colors.primaryLight, color: colors.textPrimary }
                        : undefined
                    }
                  >
                    {part.value}
                  </Text>
                ))}
              </Text>
            )}
          </TouchableOpacity>
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
                <Text style={[styles.entrySimilarity, { color: colors.primary }]}>
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
          <ScrollView
            style={styles.entryPreviewScroll}
            contentContainerStyle={styles.entryPreviewContent}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={[styles.entryPreviewText, { color: colors.textPrimary }]}>
              {previewOpen
                ? splitTextByKeyword(item.text, keyword || undefined).map((part, index) => (
                    <Text
                      key={`${part.kind}-${index}`}
                      style={
                        part.kind === 'mark'
                          ? { backgroundColor: colors.primaryLight, color: colors.textPrimary }
                          : undefined
                      }
                    >
                      {part.value}
                    </Text>
                  ))
                : null}
            </Text>
          </ScrollView>
          <View style={modalActionsStyle}>
            <Button variant="outlined" size="sm" onPress={() => setPreviewOpen(false)}>
              {t('common.close', '关闭')}
            </Button>
          </View>
        </Modal>
      </Card>
    )
  },
  (prev, next) =>
    prev.item === next.item &&
    prev.searchQuery === next.searchQuery &&
    prev.showSimilarity === next.showSimilarity &&
    (prev.activeMenuId === prev.item.embeddingId) ===
      (next.activeMenuId === next.item.embeddingId) &&
    prev.setActiveMenuId === next.setActiveMenuId &&
    prev.onDelete === next.onDelete &&
    prev.onEdit === next.onEdit
)

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
        <Text
          style={[
            styles.paginationInfo,
            { color: colors.textSecondary, marginTop: sharedTokens.spacing.mdTight }
          ]}
        >
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
          <Text
            style={[
              styles.paginationInfo,
              { color: colors.textTertiary, marginTop: sharedTokens.spacing.sm }
            ]}
          >
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
