import React, { useEffect, useRef } from 'react'
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import { KeyboardAwareScrollView } from '../KeyboardAwareScrollView'
import { useTranslation } from 'react-i18next'
import { Calendar, Pencil, Save, SquarePen, Tag, Trash2, X } from 'lucide-react-native'
import { useNativeTheme } from '../theme'
import { DEFAULT_STROKE_WIDTH } from '../../shared/icons/icon-sizes'
import { Input } from '../Input/Input'
import { MarkdownRenderer } from '../MarkdownRenderer'
import type { SummaryItem } from './gallery-panel.types'
import { TYPE_I18N_MAP, formatDateRange, formatGallerySavedAt } from './gallery-panel.utils'
import { resolveSummaryTimeDisplay } from '@baishou/shared'
import { mobileTypography, sharedTokens } from '../../theme/tokens'

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
  const timeDisplay = summary
    ? resolveSummaryTimeDisplay({
        generatedAt: summary.generatedAt,
        updatedAt: summary.updatedAt
      })
    : null

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
          {timeDisplay ? (
            <Text style={[styles.savedAtText, { color: colors.textTertiary }]}>
              {t(timeDisplay.labelKey)} {formatGallerySavedAt(timeDisplay.at)}
            </Text>
          ) : null}
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
    gap: sharedTokens.spacing.mdTight,
    padding: sharedTokens.spacing.lg
  },
  emptyText: {
    fontSize: mobileTypography.secondary.fontSize,
    textAlign: 'center'
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: sharedTokens.spacing.md,
    paddingTop: sharedTokens.spacing.mdSnug,
    paddingBottom: sharedTokens.spacing.smPlus,
    gap: sharedTokens.spacing.sm
  },
  metaRow: {
    flex: 1,
    gap: sharedTokens.spacing.sm
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: sharedTokens.spacing.xs,
    paddingHorizontal: sharedTokens.spacing.sm,
    paddingVertical: sharedTokens.spacing.xs,
    borderRadius: sharedTokens.radius.xsPlus
  },
  typeText: {
    fontSize: mobileTypography.caption.fontSize,
    fontWeight: '600'
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.xs
  },
  dateText: {
    fontSize: mobileTypography.caption.fontSize
  },
  savedAtText: {
    fontSize: mobileTypography.caption.fontSize
  },
  actions: {
    flexDirection: 'row',
    gap: sharedTokens.spacing.xs
  },
  iconBtn: {
    padding: sharedTokens.spacing.sm
  },
  detailScroll: {
    flex: 1
  },
  detailScrollContent: {
    paddingHorizontal: sharedTokens.spacing.md,
    paddingBottom: sharedTokens.spacing.lg
  },
  editor: {
    minHeight: 280,
    padding: sharedTokens.spacing.mdTight,
    fontSize: mobileTypography.body.fontSize,
    lineHeight: 22
  }
})
