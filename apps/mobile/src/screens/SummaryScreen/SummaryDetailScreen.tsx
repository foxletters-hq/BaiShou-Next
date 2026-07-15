import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Keyboard,
  ActivityIndicator,
  ScrollView
} from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import { ScreenSafeArea } from '@/src/components/ScreenSafeArea'
import {
  useNativeTheme,
  useNativeToast,
  useDialog,
  scrollIndicatorStyle,
  MarkdownRenderer
} from '@baishou/ui/native'
import { SummaryType, resolveSummaryTimeDisplay } from '@baishou/shared'
import { useBaishou } from '../../providers/BaishouProvider'
import { useTranslation } from 'react-i18next'
import * as Clipboard from 'expo-clipboard'
import { buildSummaryTitle } from './utils/buildSummaryTitle'
import {
  consumePendingSummaryDetail,
  patchSummaryDetailCache,
  type CachedSummaryDetail
} from './utils/summaryDetailCache'
import {
  loadSummaryDetailById,
  mapSummaryToDetail,
  parseSummaryBoundaryDate,
  refreshSummaryDetail,
  isSameSummaryDetail
} from './utils/summary-detail.helpers'
import { SummaryDetailEditorPane } from './components/SummaryDetailEditorPane'

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
  const navigation = useNavigation()
  const { services, dbReady } = useBaishou()
  const cachedSummaryRef = useRef(consumePendingSummaryDetail(summaryId))
  const [summary, setSummary] = useState<CachedSummaryDetail | null>(cachedSummaryRef.current)
  const [loading, setLoading] = useState(!cachedSummaryRef.current)
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const editBaselineRef = useRef('')
  const isEditingRef = useRef(false)
  const isDirtyRef = useRef(false)

  const dismissEditorKeyboard = useCallback(() => {
    Keyboard.dismiss()
  }, [])

  const isDirty = isEditing && editContent !== editBaselineRef.current
  isEditingRef.current = isEditing
  isDirtyRef.current = isDirty

  const confirmDiscardUnsaved = useCallback(async () => {
    return dialog.confirm(t('diary.exit_confirmation_hint'), {
      confirmText: t('diary.exit_without_saving_confirm'),
      destructive: true
    })
  }, [dialog, t])

  const discardAndExitEdit = useCallback(() => {
    setIsEditing(false)
    setEditContent('')
    editBaselineRef.current = ''
    isDirtyRef.current = false
    isEditingRef.current = false
    dismissEditorKeyboard()
  }, [dismissEditorKeyboard])

  useFocusEffect(
    useCallback(() => {
      return () => {
        dismissEditorKeyboard()
      }
    }, [dismissEditorKeyboard])
  )

  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', (e) => {
      dismissEditorKeyboard()
      if (!isEditingRef.current || !isDirtyRef.current) return

      e.preventDefault()
      void (async () => {
        const confirmed = await confirmDiscardUnsaved()
        if (!confirmed) return
        isDirtyRef.current = false
        isEditingRef.current = false
        setIsEditing(false)
        setEditContent('')
        editBaselineRef.current = ''
        dismissEditorKeyboard()
        onBack()
      })()
    })
    return unsub
  }, [navigation, confirmDiscardUnsaved, dismissEditorKeyboard, onBack])

  useEffect(() => {
    let cancelled = false

    const fetchSummary = async () => {
      if (!dbReady || !services) return

      const seed = cachedSummaryRef.current
      if (seed) {
        setSummary(seed)
        setLoading(false)
        try {
          const detail = await refreshSummaryDetail(seed, services)
          if (cancelled || !detail || isSameSummaryDetail(seed, detail)) return
          setSummary(detail)
        } catch (e) {
          if (cancelled) return
          console.error('[SummaryDetail] refresh error:', e)
        }
        return
      }

      setLoading(true)
      try {
        const detail = await loadSummaryDetailById(summaryId, services)
        if (cancelled) return
        if (!detail) {
          toast.showError(t('summary.not_found'))
          onBack()
          return
        }
        setSummary(detail)
      } catch (e) {
        if (cancelled) return
        console.error('[SummaryDetail] fetch error:', e)
        toast.showError(t('summary.load_failed'))
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void fetchSummary()

    return () => {
      cancelled = true
    }
  }, [summaryId, dbReady, services, onBack, t, toast])

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
    editBaselineRef.current = summary.content
    setEditContent(summary.content)
    setIsEditing(true)
  }

  const handleCancelEdit = async () => {
    if (isDirty) {
      const confirmed = await confirmDiscardUnsaved()
      if (!confirmed) return
    }
    discardAndExitEdit()
  }

  const handleSave = async (nextContent?: string) => {
    const contentToSave = nextContent ?? editContent
    if (!summary || !services) return

    setIsSaving(true)
    try {
      const startDate = parseSummaryBoundaryDate(summary.startDate)
      const endDate = parseSummaryBoundaryDate(summary.endDate)
      const updated = await services.summaryManager.update(
        summary.id ?? 0,
        summary.type as SummaryType,
        startDate,
        endDate,
        {
          content: contentToSave
        }
      )
      const detail = await services.summaryManager.readDetail(
        summary.type as SummaryType,
        startDate,
        endDate
      )
      const nextSummary = detail
        ? mapSummaryToDetail(detail)
        : {
            ...summary,
            content: contentToSave,
            id: updated?.id ?? summary.id
          }
      const toIso = (value: Date | string | null | undefined) =>
        value instanceof Date ? value.toISOString() : value != null ? String(value) : undefined
      const summaryWithTimes: CachedSummaryDetail = {
        ...nextSummary,
        generatedAt: toIso(updated?.generatedAt) ?? nextSummary.generatedAt ?? summary.generatedAt,
        updatedAt: toIso(updated?.updatedAt) ?? new Date().toISOString()
      }
      setSummary(summaryWithTimes)
      patchSummaryDetailCache(summaryWithTimes)
      isDirtyRef.current = false
      isEditingRef.current = false
      editBaselineRef.current = ''
      setIsEditing(false)
      setEditContent('')
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
      const startDate = parseSummaryBoundaryDate(summary.startDate)
      const endDate = parseSummaryBoundaryDate(summary.endDate)
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
    return parseSummaryBoundaryDate(d).toLocaleDateString(undefined, {
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

  const summaryTimeDisplay = summary
    ? resolveSummaryTimeDisplay({
        generatedAt: summary.generatedAt,
        updatedAt: summary.updatedAt
      })
    : null

  const showBlockingLoad = loading && !summary

  if (isEditing && summary) {
    return (
      <SummaryDetailEditorPane
        summary={summary}
        editContent={editContent}
        isSaving={isSaving}
        onContentChange={setEditContent}
        onSave={(content) => {
          void handleSave(content)
        }}
        onCancel={() => {
          void handleCancelEdit()
        }}
      />
    )
  }

  const typeLabel = summary ? t(TYPE_I18N_MAP[summary.type] || summary.type) : ''

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

        {summary && !showBlockingLoad ? (
          <View style={styles.headerActions}>
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
          </View>
        ) : null}
      </View>

      {showBlockingLoad ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            {t('common.loading')}
          </Text>
        </View>
      ) : summary ? (
        <ScrollView
          style={[styles.content, { backgroundColor: colors.bgApp }]}
          contentContainerStyle={styles.contentScroll}
          indicatorStyle={scrollIndicatorStyle(isDark)}
          keyboardShouldPersistTaps="handled"
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

            {summaryTimeDisplay ? (
              <View style={styles.dateContainerLast}>
                <Text style={[styles.dateLabel, { color: colors.textSecondary }]}>
                  {t(summaryTimeDisplay.labelKey)} {formatGeneratedAt(summaryTimeDisplay.at)}
                </Text>
              </View>
            ) : (
              <View style={styles.generatedAtPlaceholder} />
            )}
          </View>

          <View
            style={[
              styles.contentCard,
              { backgroundColor: colors.bgSurface, borderColor: colors.borderMuted }
            ]}
          >
            <MarkdownRenderer
              content={summary.content}
              style={styles.contentText}
              selectable={false}
            />
          </View>
        </ScrollView>
      ) : null}
    </ScreenSafeArea>
  )
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12
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
  generatedAtPlaceholder: {
    height: 20
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
  }
})
