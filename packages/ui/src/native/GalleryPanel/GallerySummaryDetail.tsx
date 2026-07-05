import React, { useEffect, useRef } from 'react'
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import { KeyboardAwareScrollView } from '../KeyboardAwareScrollView'
import { useTranslation } from 'react-i18next'
import {
  Calendar,
  Pencil,
  Save,
  SquarePen,
  Tag,
  Trash2,
  X
} from 'lucide-react-native'
import { useNativeTheme } from '../theme'
import { DEFAULT_STROKE_WIDTH } from '../../shared/icons/icon-sizes'
import { Input } from '../Input/Input'
import { MarkdownRenderer } from '../MarkdownRenderer'
import type { SummaryItem } from './gallery-panel.types'
import { TYPE_I18N_MAP, formatDateRange } from './gallery-panel.utils'

interface GallerySummaryDetailProps {
  summary?: SummaryItem
  isEditing: boolean
  editContent: string
  isSaving: boolean
  canInlineEdit: boolean
  onEditContentChange: (content: string) => void
  onStartInlineEdit: (content: string) => void
  onEdit?: (id: string) => void
  onDelete?: (id: string) => void
  onSave: () => void
  onCancel: () => void
}

export const GallerySummaryDetail: React.FC<GallerySummaryDetailProps> = ({
  summary,
  isEditing,
  editContent,
  isSaving,
  canInlineEdit,
  onEditContentChange,
  onStartInlineEdit,
  onEdit,
  onDelete,
  onSave,
  onCancel
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const scrollRef = useRef<React.ComponentRef<typeof KeyboardAwareScrollView>>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false })
  }, [summary?.id, isEditing])

  if (!summary) {
    return (
      <View style={[styles.detail, styles.emptyDetail, { backgroundColor: colors.bgSurface }]}>
        <SquarePen size={48} color={colors.textTertiary} strokeWidth={DEFAULT_STROKE_WIDTH} />
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          {t('gallery.select_summary', '选择一个总结查看详情')}
        </Text>
      </View>
    )
  }

  return (
    <View
      style={[
        styles.detail,
        { backgroundColor: colors.bgSurface, borderColor: colors.borderSubtle }
      ]}
    >
      <View style={styles.detailHeader}>
        <View style={styles.metaRow}>
          <View style={[styles.typeBadge, { backgroundColor: colors.primaryLight }]}>
            <Tag size={12} color={colors.primary} strokeWidth={DEFAULT_STROKE_WIDTH} />
            <Text style={[styles.typeText, { color: colors.primary }]}>
              {t(TYPE_I18N_MAP[summary.type] || summary.type)}
            </Text>
          </View>
          <View style={styles.dateRow}>
            <Calendar size={12} color={colors.textTertiary} strokeWidth={DEFAULT_STROKE_WIDTH} />
            <Text style={[styles.dateText, { color: colors.textTertiary }]}>
              {formatDateRange(summary)}
            </Text>
          </View>
        </View>
        <View style={styles.actions}>
          {isEditing ? (
            <>
              <Pressable style={styles.iconBtn} onPress={onSave} disabled={isSaving}>
                {isSaving ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Save size={18} color={colors.primary} strokeWidth={DEFAULT_STROKE_WIDTH} />
                )}
              </Pressable>
              <Pressable style={styles.iconBtn} onPress={onCancel} disabled={isSaving}>
                <X size={18} color={colors.textSecondary} strokeWidth={DEFAULT_STROKE_WIDTH} />
              </Pressable>
            </>
          ) : (
            <>
              <Pressable
                style={styles.iconBtn}
                onPress={() => {
                  if (canInlineEdit) onStartInlineEdit(summary.content)
                  else onEdit?.(String(summary.id))
                }}
              >
                <Pencil size={18} color={colors.textSecondary} strokeWidth={DEFAULT_STROKE_WIDTH} />
              </Pressable>
              <Pressable style={styles.iconBtn} onPress={() => onDelete?.(String(summary.id))}>
                <Trash2 size={18} color={colors.error} strokeWidth={DEFAULT_STROKE_WIDTH} />
              </Pressable>
            </>
          )}
        </View>
      </View>
      <KeyboardAwareScrollView
        ref={scrollRef}
        style={styles.detailScroll}
        contentContainerStyle={styles.detailScrollContent}
      >
        {isEditing ? (
          <Input
            style={styles.editor}
            value={editContent}
            onChangeText={onEditContentChange}
            multiline
            textarea
            placeholder={t('summary.content_placeholder')}
          />
        ) : (
          <MarkdownRenderer content={summary.content} />
        )}
      </KeyboardAwareScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  detail: {
    flex: 1,
    minWidth: 0,
    borderLeftWidth: 1
  },
  emptyDetail: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center'
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    gap: 8
  },
  metaRow: {
    flex: 1,
    gap: 8
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6
  },
  typeText: {
    fontSize: 12,
    fontWeight: '600'
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  dateText: {
    fontSize: 12
  },
  actions: {
    flexDirection: 'row',
    gap: 4
  },
  iconBtn: {
    padding: 8
  },
  detailScroll: {
    flex: 1
  },
  detailScrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24
  },
  editor: {
    minHeight: 280,
    padding: 12,
    fontSize: 15,
    lineHeight: 22
  }
})
