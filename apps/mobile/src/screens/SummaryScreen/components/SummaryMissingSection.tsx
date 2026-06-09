import React from 'react'
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import { useTranslation } from 'react-i18next'
import { MaterialIcons } from '@expo/vector-icons'
import { useNativeTheme } from '@baishou/ui/native'
import { ConcurrencyDropdown } from './ConcurrencyDropdown'

export interface MissingPeriod {
  type: string
  startDate: string
  endDate: string
  label?: string
  dateRangeStr?: string
}

export const getTaskStatusText = (
  taskState: { progress: number; phase: number; status: string; error?: string } | undefined,
  t: (key: string) => string
): string => {
  if (!taskState) return ''
  const { status, phase, progress, error } = taskState

  if (status === 'pending') return t('summary.preparing')
  if (status === 'completed' || progress >= 100) return t('summary.step_done')
  if (status === 'error') {
    return `${t('summary.generation_failed')}: ${error || ''}`
  }
  if (status === 'running' || status === 'processing') {
    if (phase === 0) return t('summary.status_sending')
    if (phase === 1) return t('summary.status_reading_data')
    if (phase === 2) {
      return t('summary.status_thinking').replace(' ($model)', '').replace('($model)', '')
    }
    if (phase === 3) return t('summary.step_write')
    if (progress === 95) return t('summary.status_saving')
  }
  return ''
}

interface SummaryMissingSectionProps {
  missingSummaries: MissingPeriod[]
  generationStates: Record<string, any>
  stats: { totalDiaryCount: number }
  isBatchGenerating: boolean
  concurrencyLimit: number
  onBatchGenerate: () => void
  onStopGeneration: () => void
  onConcurrencyChange: (n: number) => void
  onQueueSingle: (item: MissingPeriod) => void
}

export const SummaryMissingSection: React.FC<SummaryMissingSectionProps> = ({
  missingSummaries,
  generationStates,
  stats,
  isBatchGenerating,
  concurrencyLimit,
  onBatchGenerate,
  onStopGeneration,
  onConcurrencyChange,
  onQueueSingle
}) => {
  const { t, i18n } = useTranslation()
  const { colors } = useNativeTheme()
  const { language } = i18n
  const genStatesArr = Object.values(generationStates)
  const genTotal = genStatesArr.length
  const genCompleted = genStatesArr.filter((s) => s.status === 'completed').length
  const genError = genStatesArr.filter((s) => s.status === 'error').length
  const genProgress =
    genTotal > 0
      ? Math.round(genStatesArr.reduce((sum, s) => sum + (s.progress || 0), 0) / genTotal)
      : 0
  const isGenerating = genStatesArr.some(
    (s) => s.status === 'pending' || s.status === 'running' || s.status === 'processing'
  )

  if (missingSummaries.length === 0 && stats.totalDiaryCount === 0) {
    return null
  }

  return (
    <View style={styles.wrap}>
      {(missingSummaries.length > 0 || stats.totalDiaryCount > 0) && (
        <View style={styles.titleRow}>
          <MaterialIcons name="auto-awesome" size={18} color={colors.warning ?? colors.primary} />
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            {t('summary.ai_suggestions')}
          </Text>
          <Text
            style={[
              styles.countBadge,
              { backgroundColor: colors.primaryLight, color: colors.primary }
            ]}
          >
            {t('common.count_items').replace('$count', String(missingSummaries.length))}
          </Text>
        </View>
      )}

      {genTotal > 0 && (
        <View style={styles.progressWrap}>
          <View style={[styles.progressTrack, { backgroundColor: colors.bgSurfaceHighest }]}>
            <View
              style={[
                styles.progressFill,
                { width: `${genProgress}%`, backgroundColor: colors.primary }
              ]}
            />
          </View>
          <View style={styles.progressMeta}>
            <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
              {genCompleted}/{genTotal}
              {genError > 0 && (
                <Text style={{ color: colors.error }}>
                  {' '}
                  ({t('summary.failed_count').replace('{{count}}', String(genError))})
                </Text>
              )}
            </Text>
            <View style={styles.progressActions}>
              {isGenerating ? (
                <Pressable
                  style={[
                    styles.actionBtn,
                    {
                      backgroundColor: 'rgba(239, 68, 68, 0.1)',
                      borderColor: colors.error,
                      borderWidth: 1
                    }
                  ]}
                  onPress={onStopGeneration}
                >
                  <MaterialIcons name="cancel" size={14} color={colors.error} />
                  <Text style={[styles.actionBtnText, { color: colors.error }]}>
                    {t('summary.stop')}
                  </Text>
                </Pressable>
              ) : (
                <Pressable
                  style={[styles.actionBtn, { backgroundColor: colors.primaryLight }]}
                  onPress={onBatchGenerate}
                  disabled={isBatchGenerating}
                >
                  <MaterialIcons name="auto-awesome" size={14} color={colors.primary} />
                  <Text style={[styles.actionBtnText, { color: colors.primary }]}>
                    {isBatchGenerating ? t('summary.generating') : t('summary.generate_all')}
                  </Text>
                </Pressable>
              )}
              <ConcurrencyDropdown
                value={concurrencyLimit}
                onChange={onConcurrencyChange}
                disabled={isGenerating}
              />
            </View>
          </View>
        </View>
      )}

      {genTotal === 0 && missingSummaries.length > 0 && !isBatchGenerating && (
        <View style={styles.progressActions}>
          <Pressable
            style={[styles.actionBtn, { backgroundColor: colors.primaryLight }]}
            onPress={onBatchGenerate}
            disabled={isBatchGenerating}
          >
            <MaterialIcons name="auto-awesome" size={14} color={colors.primary} />
            <Text style={[styles.actionBtnText, { color: colors.primary }]}>
              {t('summary.generate_all')}
            </Text>
          </Pressable>
          <ConcurrencyDropdown
            value={concurrencyLimit}
            onChange={onConcurrencyChange}
            disabled={isBatchGenerating}
          />
        </View>
      )}

      {missingSummaries.length === 0 && stats.totalDiaryCount > 0 && (
        <View
          style={[
            styles.emptyBox,
            { backgroundColor: colors.bgSurface, borderColor: colors.borderMuted }
          ]}
        >
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            {t('summary.no_missing')}
          </Text>
        </View>
      )}

      <View style={styles.grid}>
        {missingSummaries.map((mp) => {
          const uKey = `${mp.type}_${new Date(mp.startDate).getTime()}`
          const taskState = generationStates[uKey]
          const isRunning = taskState?.status === 'running' || taskState?.status === 'processing'
          const isPending = taskState?.status === 'pending'
          const isCompleted = taskState?.status === 'completed'
          const progress = taskState?.progress || 0
          const statusText = getTaskStatusText(taskState, t)

          return (
            <View key={uKey} style={styles.cardBlock}>
              <View
                style={[
                  styles.card,
                  {
                    backgroundColor: colors.bgSurface,
                    borderColor: colors.borderMuted
                  }
                ]}
              >
                <View style={[styles.cardIconBox, { backgroundColor: colors.primaryLight }]}>
                  <Text style={styles.cardEmoji}>
                    {mp.type === 'weekly'
                      ? '🌱'
                      : mp.type === 'monthly'
                        ? '☘️'
                        : mp.type === 'quarterly'
                          ? '🪴'
                          : '🌳'}
                  </Text>
                </View>
                <View style={styles.cardBody}>
                  <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
                    {mp.label || mp.dateRangeStr}
                  </Text>
                  <View style={styles.cardMeta}>
                    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                      {mp.startDate &&
                        new Date(mp.startDate).toLocaleDateString(language, {
                          month: 'short',
                          day: 'numeric'
                        })}
                      {' - '}
                      {mp.endDate &&
                        new Date(mp.endDate).toLocaleDateString(language, {
                          month: 'short',
                          day: 'numeric'
                        })}
                    </Text>
                    <Text style={[styles.badge, { color: colors.primary }]}>
                      {t('summary.suggestion_generate')}
                    </Text>
                  </View>
                </View>
                <Pressable
                  style={styles.cardAction}
                  onPress={() => onQueueSingle(mp)}
                  disabled={isRunning || isPending}
                >
                  {isRunning && progress < 100 ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : isPending ? (
                    <MaterialIcons name="schedule" size={20} color={colors.textTertiary} />
                  ) : isCompleted || progress >= 100 ? (
                    <MaterialIcons name="check-circle" size={22} color={colors.success} />
                  ) : (
                    <MaterialIcons name="auto-awesome" size={18} color={colors.primary} />
                  )}
                </Pressable>
              </View>
              {statusText ? (
                <View style={[styles.statusRow, { borderColor: colors.borderSubtle }]}>
                  <View style={[styles.statusDot, { backgroundColor: colors.primary }]} />
                  <Text style={{ color: colors.textSecondary, fontSize: 12, flex: 1 }}>
                    {statusText}
                  </Text>
                </View>
              ) : null}
            </View>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 8,
    paddingBottom: 24,
    gap: 12
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1
  },
  countBadge: {
    fontSize: 13,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden'
  },
  emptyBox: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'solid',
    alignItems: 'center',
    justifyContent: 'center'
  },
  progressWrap: {
    gap: 8
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden'
  },
  progressFill: {
    height: '100%',
    borderRadius: 3
  },
  progressMeta: {
    gap: 8
  },
  progressActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '600'
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: 16,
    fontSize: 14
  },
  grid: {
    gap: 12
  },
  cardBlock: {
    gap: 6
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'solid',
    gap: 12
  },
  cardIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  cardEmoji: {
    fontSize: 20
  },
  cardBody: {
    flex: 1,
    gap: 4
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600'
  },
  cardMeta: {
    gap: 2
  },
  badge: {
    fontSize: 12,
    fontWeight: '600'
  },
  cardAction: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center'
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 8
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3
  }
})
