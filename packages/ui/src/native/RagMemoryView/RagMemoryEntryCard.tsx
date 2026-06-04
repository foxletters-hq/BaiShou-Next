import React, { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Pressable,
  ScrollView
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import { Pagination as RagPagination } from '../Pagination'
import { SettingsSection } from '../SettingsSection'
import type { RagEntry } from './rag-memory.types'
import { ragMemoryStyles as styles } from './rag-memory.styles'

interface RagMemoryEntryCardProps {
  item: RagEntry
  activeMenuId: string | null
  setActiveMenuId: (id: string | null) => void
  onDelete?: (id: string) => Promise<void>
  onEdit?: (entry: RagEntry) => Promise<void>
}

export const RagMemoryEntryCard: React.FC<RagMemoryEntryCardProps> = ({
  item,
  activeMenuId,
  setActiveMenuId,
  onDelete,
  onEdit
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const [deleting, setDeleting] = useState(false)
  const menuOpen = activeMenuId === item.embeddingId

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
          backgroundColor: colors.bgSurface,
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
            <Text style={{ color: colors.textSecondary, fontSize: 18, fontWeight: '700' }}>⋮</Text>
          </TouchableOpacity>
        </View>
        {menuOpen && (
          <View
            style={[
              styles.entryMenu,
              { backgroundColor: colors.bgSurface, borderColor: colors.borderSubtle }
            ]}
          >
            {onEdit && (
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
                  <Text style={{ color: colors.error }}>{t('common.delete')}</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}
        <Text style={[styles.entryText, { color: colors.textPrimary }]} numberOfLines={4}>
          {item.text}
        </Text>
        <View style={styles.entryFooter}>
          <Text style={[styles.entryDate, { color: colors.textTertiary }]}>
            {new Date(item.createdAt).toLocaleDateString()}
          </Text>
          {item.similarity !== undefined && (
            <View style={[styles.entrySimilarity, { backgroundColor: 'rgba(91, 168, 245, 0.1)' }]}>
              <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700' }}>
                {(item.similarity * 100).toFixed(0)}%
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  )
}

const PAGE_SIZES = [10, 20, 30, 50, 100]

interface RagMemoryEntriesSectionProps {
  entries: RagEntry[]
  searchQuery?: string
  totalCount?: number
  currentPage?: number
  pageSize?: number
  onDeleteEntry?: (id: string) => Promise<void>
  onEditEntry?: (entry: RagEntry) => Promise<void>
  onPageChange?: (page: number, pageSize: number) => void
}

export const RagMemoryEntriesSection: React.FC<RagMemoryEntriesSectionProps> = ({
  entries,
  searchQuery = '',
  totalCount = 0,
  currentPage = 1,
  pageSize = 10,
  onDeleteEntry,
  onEditEntry,
  onPageChange
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null)

  const effectiveTotal = totalCount > 0 ? totalCount : entries.length
  const totalPages = Math.max(1, Math.ceil(effectiveTotal / pageSize))
  const showPagination = effectiveTotal > 10

  return (
    <SettingsSection title={t('settings.rag_entries')}>
      {entries.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={[styles.paginationInfo, { color: colors.textSecondary }]}>
            {searchQuery.trim() ? t('common.no_search_result') : t('common.no_content')}
          </Text>
          <Text style={[styles.paginationInfo, { color: colors.textTertiary, marginTop: 8 }]}>
            {t('settings.rag_empty_desc')}
          </Text>
        </View>
      ) : (
        entries.map((item) => (
          <RagMemoryEntryCard
            key={item.embeddingId}
            item={item}
            activeMenuId={activeMenuId}
            setActiveMenuId={setActiveMenuId}
            onDelete={onDeleteEntry}
            onEdit={onEditEntry}
          />
        ))
      )}

      {showPagination && onPageChange && (
        <View style={styles.paginationRow}>
          <Text style={[styles.paginationInfo, { color: colors.textSecondary }]}>
            {t('settings.rag_pagination_info').replace('$total', String(effectiveTotal))}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pageSizeRow}>
            {PAGE_SIZES.map((size) => {
              const selected = pageSize === size
              return (
                <TouchableOpacity
                  key={size}
                  style={[
                    styles.pageSizeChip,
                    {
                      borderColor: selected ? colors.primary : colors.borderMuted,
                      backgroundColor: selected ? colors.primaryContainer : 'transparent'
                    }
                  ]}
                  onPress={() => onPageChange(1, size)}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      color: selected ? colors.primary : colors.textSecondary
                    }}
                  >
                    {size} {t('settings.rag_per_page')}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </ScrollView>
          <RagPagination
            current={currentPage}
            total={totalPages}
            onChange={(page) => onPageChange(page, pageSize)}
            showFirstLast
            showJumper
          />
        </View>
      )}
    </SettingsSection>
  )
}
