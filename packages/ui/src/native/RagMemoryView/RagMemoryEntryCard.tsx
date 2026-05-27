import React, { useState } from 'react'
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import { SettingsSection } from '../SettingsSection'
import type { RagEntry } from './rag-memory.types'
import { ragMemoryStyles as styles } from './rag-memory.styles'

interface RagMemoryEntryCardProps {
  item: RagEntry
  onDelete?: (id: string) => Promise<void>
}

export const RagMemoryEntryCard: React.FC<RagMemoryEntryCardProps> = ({ item, onDelete }) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    if (!onDelete) return
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
          backgroundColor: colors.bgSurfaceNormal,
          borderColor: colors.borderSubtle
        }
      ]}
    >
      <View style={styles.entryHeader}>
        <Text style={[styles.entryModel, { color: colors.primary }]} numberOfLines={1}>
          {item.modelId}
        </Text>
        {onDelete && (
          <TouchableOpacity activeOpacity={0.7} onPress={handleDelete} disabled={deleting}>
            {deleting ? (
              <ActivityIndicator size="small" color={colors.error} />
            ) : (
              <Text style={[styles.deleteBtn, { color: colors.error }]}>
                {t('common.delete', '删除')}
              </Text>
            )}
          </TouchableOpacity>
        )}
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
}

interface RagMemoryEntriesSectionProps {
  entries: RagEntry[]
  onDeleteEntry?: (id: string) => Promise<void>
}

export const RagMemoryEntriesSection: React.FC<RagMemoryEntriesSectionProps> = ({
  entries,
  onDeleteEntry
}) => {
  const { t } = useTranslation()

  if (entries.length === 0) return null

  return (
    <SettingsSection title={t('rag.entries', '记忆条目')}>
      {entries.map((item) => (
        <RagMemoryEntryCard key={item.embeddingId} item={item} onDelete={onDeleteEntry} />
      ))}
    </SettingsSection>
  )
}
