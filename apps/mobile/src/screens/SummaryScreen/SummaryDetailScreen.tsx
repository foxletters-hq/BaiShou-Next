import React, { useState, useEffect, useRef } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, StatusBar } from 'react-native'
import { ScreenSafeArea } from '@/src/components/ScreenSafeArea'
import {
  useNativeTheme,
  useNativeToast,
  useDialog,
  scrollIndicatorStyle,
  KeyboardAwareScrollView,
  MarkdownRenderer,
  Input
} from '@baishou/ui/native'
import { useBaishou } from '../../providers/BaishouProvider'
import { useTranslation } from 'react-i18next'
import * as Clipboard from 'expo-clipboard'
import { SummaryType } from '@baishou/shared'
import { buildSummaryTitle } from './utils/buildSummaryTitle'
import { consumePendingSummaryDetail } from './utils/summaryDetailCache'

interface SummaryDetail {
  id?: number
  type: string
  startDate: string
  endDate: string
  content: string
  sourceIds?: string | null
  generatedAt?: string
}

interface SummaryDetailScreenProps {
  summaryId: string
  onBack: () => void
}

const TYPE_I18N_MAP: Record<string, string> = {
  weekly: 'summary.stats_week',
  monthly: 'summary.stats_month',
  quarterly: 'summary.stats_quarter',
  yearly: 'summary.stats_year'
}

export const SummaryDetailScreen: React.FC<SummaryDetailScreenProps> = ({ summaryId, onBack }) => {
  const { t } = useTranslation()
  const { colors, isDark } = useNativeTheme()
  const toast = useNativeToast()
  const dialog = useDialog()
  const { services, dbReady } = useBaishou()
  const cachedSummaryRef = useRef(consumePendingSummaryDetail(summaryId))
  const [summary, setSummary] = useState<SummaryDetail | null>(cachedSummaryRef.current)
  const [loading, setLoading] = useState(!cachedSummaryRef.current)
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    const fetchSummary = async () => {
      if (!dbReady || !services) return

      if (cachedSummaryRef.current) {
        setSummary(cachedSummaryRef.current)
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        const summaryList = await services.summaryManager.list()
        const found = summaryList.find((s) => String(s.id) === summaryId)
        if (found) {
          const toIso = (v: Date | string | undefined) =>
            v instanceof Date ? v.toISOString() : v != null ? String(v) : ''
          setSummary({
            id: found.id,
            type: found.type,
            startDate: toIso(found.startDate),
            endDate: toIso(found.endDate),
            content: found.content,
            sourceIds: found.sourceIds,
            generatedAt: found.generatedAt != null ? toIso(found.generatedAt) : undefined
          })
        } else {
          toast.showError(t('summary.not_found'))
          onBack()
        }
      } catch (e) {
        console.error('[SummaryDetail] fetch error:', e)
        toast.showError(t('summary.load_failed'))
      } finally {
        setLoading(false)
      }
    }
    fetchSummary()
  }, [summaryId, dbReady, services, onBack, t])

  const handleCopy = async () => {
    if (!summary?.content) return
    try {
      await Clipboard.setStringAsync(summary.content)
      toast.showSuccess(t('common.copy_success'))
    } catch (e) {
      console.error('[SummaryDetail] copy error:', e)
      toast.showError(t('common.copy_failed'))
    }
  }

  const handleEdit = () => {
    if (!summary) return
    setEditContent(summary.content)
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditContent('')
  }

  const handleSave = async () => {
    if (!summary || !summary.id || !services) return
    setIsSaving(true)
    try {
      const startDate = new Date(summary.startDate)
      const endDate = new Date(summary.endDate)
      await services.summaryManager.update(
        summary.id,
        summary.type as SummaryType,
        startDate,
        endDate,
        {
          content: editContent
        }
      )
      setSummary({ ...summary, content: editContent })
      setIsEditing(false)
      toast.showSuccess(t('common.save_success'))
    } catch (e) {
      console.error('[SummaryDetail] save error:', e)
      toast.showError(t('common.save_failed'))
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!summary || !services) return
    const title = buildSummaryTitle(summary, t)
    const confirmed = await dialog.confirm(t('summary.delete_confirm').replace('$title', title), {
      confirmText: t('common.delete'),
      destructive: true
    })
    if (!confirmed) return
    try {
      const startDate = new Date(summary.startDate)
      const endDate = new Date(summary.endDate)
      await services.summaryManager.delete(summary.type as SummaryType, startDate, endDate)
      toast.showSuccess(t('common.delete_success'))
      onBack()
    } catch (e) {
      console.error('[SummaryDetail] delete error:', e)
      toast.showError(t('common.delete_failed'))
    }
  }

  const formatDate = (d: string) => {
    if (!d) return ''
    return new Date(d).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const formatGeneratedAt = (d?: string) => {
    if (!d) return ''
    try {
      const date = new Date(d)
      if (isNaN(date.getTime())) return ''
      const year = date.getFullYear()
      if (year < 2000 || year > 2100) return ''
      return date.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return ''
    }
  }

  if (loading) {
    return (
      <ScreenSafeArea preset="screen" style={{ backgroundColor: colors.bgApp }}>
        <StatusBar
          barStyle={isDark ? 'light-content' : 'dark-content'}
          backgroundColor={colors.bgApp}
        />
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            {t('common.loading')}
          </Text>
        </View>
      </ScreenSafeArea>
    )
  }

  if (!summary) return null

  const typeLabel = t(TYPE_I18N_MAP[summary.type] || summary.type)

  return (
    <ScreenSafeArea preset="screen" style={{ backgroundColor: colors.bgApp }}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.bgApp}
      />

      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.bgSurface,
            borderBottomColor: colors.borderSubtle
          }
        ]}
      >
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={[styles.backButtonText, { color: colors.primary }]}>
            ← {t('common.back')}
          </Text>
        </TouchableOpacity>

        <View style={styles.headerActions}>
          {isEditing ? (
            <>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.primary }]}
                onPress={handleSave}
                disabled={isSaving}
              >
                <Text style={[styles.actionButtonText, { color: colors.textOnPrimary }]}>
                  {isSaving ? t('common.saving') : t('common.save')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.bgSurfaceHighest }]}
                onPress={handleCancelEdit}
              >
                <Text style={[styles.actionButtonText, { color: colors.textSecondary }]}>
                  {t('common.cancel')}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.primary }]}
                onPress={handleEdit}
              >
                <Text style={[styles.actionButtonText, { color: colors.textOnPrimary }]}>
                  {t('common.edit')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.bgSurfaceHighest }]}
                onPress={handleCopy}
              >
                <Text style={[styles.actionButtonText, { color: colors.textSecondary }]}>
                  {t('common.copy')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.error }]}
                onPress={handleDelete}
              >
                <Text style={[styles.actionButtonText, { color: colors.textOnPrimary }]}>
                  {t('common.delete')}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      <KeyboardAwareScrollView
        style={[styles.content, { backgroundColor: colors.bgApp }]}
        contentContainerStyle={styles.contentScroll}
        indicatorStyle={scrollIndicatorStyle(isDark)}
      >
          <View
            style={[
              styles.metaCard,
              { backgroundColor: colors.bgSurface, borderColor: colors.borderMuted }
            ]}
          >
            <View style={[styles.typeBadge, { backgroundColor: colors.primary + '20' }]}>
              <Text style={[styles.typeBadgeText, { color: colors.primary }]}>{typeLabel}</Text>
            </View>

            <View style={styles.dateContainer}>
              <Text style={[styles.dateText, { color: colors.textPrimary }]}>
                {formatDate(summary.startDate)} — {formatDate(summary.endDate)}
              </Text>
            </View>

            {summary.generatedAt ? (
              <View style={styles.dateContainerLast}>
                <Text style={[styles.dateLabel, { color: colors.textSecondary }]}>
                  {t('summary.generated_at')} {formatGeneratedAt(summary.generatedAt)}
                </Text>
              </View>
            ) : null}
          </View>

          <View
            style={[
              styles.contentCard,
              { backgroundColor: colors.bgSurface, borderColor: colors.borderMuted }
            ]}
          >
            {isEditing ? (
              <Input
                value={editContent}
                onChangeText={setEditContent}
                multiline
                placeholder={t('summary.content_placeholder')}
                style={styles.contentInput}
              />
            ) : (
              <MarkdownRenderer content={summary.content} style={styles.contentText} />
            )}
          </View>
      </KeyboardAwareScrollView>
    </ScreenSafeArea>
  )
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  loadingText: {
    fontSize: 16
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1
  },
  backButton: {
    padding: 8
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600'
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600'
  },
  content: {
    flex: 1
  },
  contentScroll: {
    padding: 16,
    gap: 12,
    paddingBottom: 32
  },
  metaCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'solid',
    padding: 16
  },
  contentCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'solid',
    padding: 16
  },
  typeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 12
  },
  typeBadgeText: {
    fontSize: 14,
    fontWeight: '600'
  },
  dateContainer: {
    marginBottom: 8
  },
  dateContainerLast: {
    marginBottom: 0
  },
  dateLabel: {
    fontSize: 14
  },
  dateText: {
    fontSize: 16
  },
  contentText: {
    fontSize: 16,
    lineHeight: 24
  },
  contentInput: {
    fontSize: 16,
    lineHeight: 24,
    minHeight: 200
  }
})
