import React, { useEffect, useMemo, useState } from 'react'
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { FloatingModal, useNativeTheme } from '@baishou/ui/native'
import {
  clampGraphMonthRange,
  defaultGraphMonthRange,
  formatGraphMonth,
  isDefaultGraphMonthRange,
  parseGraphMonthToDate,
  type GraphMonthRange
} from '@baishou/shared'

export interface GraphMonthRangeSheetProps {
  value: GraphMonthRange
  onChange: (next: GraphMonthRange) => void
  /** Stretch trigger to full width (settings). */
  block?: boolean
  /** Extra style on the trigger Pressable. */
  style?: object
}

type EditTarget = 'start' | 'end'

function yearList(now = new Date()): number[] {
  const end = now.getFullYear()
  const start = 2000
  return Array.from({ length: end - start + 1 }, (_, i) => start + i)
}

function monthLabel(monthNames: string[] | unknown, month: string): string {
  const d = parseGraphMonthToDate(month)
  const names = Array.isArray(monthNames) ? (monthNames as string[]) : null
  const name = names?.[d.getMonth()] ?? `${d.getMonth() + 1}月`
  return `${d.getFullYear()} ${name}`
}

function rangeFromMonthsBack(months: number): GraphMonthRange {
  return defaultGraphMonthRange(new Date(), months)
}

/**
 * Mobile month-range picker: presets + start/end year-month selection via FloatingModal.
 */
export function GraphMonthRangeSheet({
  value,
  onChange,
  block,
  style
}: GraphMonthRangeSheetProps) {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<GraphMonthRange>(value)
  const [editTarget, setEditTarget] = useState<EditTarget>('start')
  const [viewYear, setViewYear] = useState(() =>
    parseGraphMonthToDate(value.startMonth).getFullYear()
  )

  const monthNames = t('common.months', { returnObjects: true }) as string[]
  const years = useMemo(() => yearList(), [])
  const isRecent3 = isDefaultGraphMonthRange(value)
  const activeMonth = editTarget === 'start' ? draft.startMonth : draft.endMonth

  useEffect(() => {
    if (!open) return
    setDraft(value)
    setEditTarget('start')
    setViewYear(parseGraphMonthToDate(value.startMonth).getFullYear())
  }, [open, value])

  const selectMonth = (monthIndex: number) => {
    const nextMonth = formatGraphMonth(new Date(viewYear, monthIndex, 1))
    setDraft((prev) => {
      if (editTarget === 'start') {
        const startMonth = nextMonth
        const endMonth = startMonth > prev.endMonth ? startMonth : prev.endMonth
        return { startMonth, endMonth }
      }
      const endMonth = nextMonth
      const startMonth = endMonth < prev.startMonth ? endMonth : prev.startMonth
      return { startMonth, endMonth }
    })
    if (editTarget === 'start') setEditTarget('end')
  }

  const applyDraft = () => {
    onChange(clampGraphMonthRange(draft))
    setOpen(false)
  }

  const applyPreset = (months: number) => {
    const next = rangeFromMonthsBack(months)
    setDraft(next)
    onChange(next)
    setOpen(false)
  }

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={[
          styles.trigger,
          {
            backgroundColor: colors.bgSurfaceNormal,
            borderColor: isRecent3 ? colors.borderSubtle : colors.primary,
            alignSelf: block ? 'stretch' : 'flex-start'
          },
          style
        ]}
      >
        <Text style={[styles.triggerRange, { color: colors.textPrimary }]} numberOfLines={1}>
          {monthLabel(monthNames, value.startMonth)}
          <Text style={{ color: colors.textSecondary }}> — </Text>
          {monthLabel(monthNames, value.endMonth)}
        </Text>
        <Text
          style={[
            styles.triggerBadge,
            { color: isRecent3 ? colors.textSecondary : colors.primary }
          ]}
        >
          {isRecent3
            ? t('graph.month_range_recent3', '近3月')
            : t('graph.month_range_custom', '自定义')}
        </Text>
      </Pressable>

      <FloatingModal visible={open} onClose={() => setOpen(false)} maxWidth={420}>
        <ScrollView
          style={styles.modalScroll}
          contentContainerStyle={styles.modalContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
            {t('graph.month_range_dialog', '选择月份范围')}
          </Text>
          <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
            {t(
              'graph.month_range_dialog_hint',
              '先选起始月，再选结束月；图谱只展示该区间内的关系。'
            )}
          </Text>
          <Text style={[styles.preview, { color: colors.textPrimary }]}>
            {monthLabel(monthNames, draft.startMonth)} — {monthLabel(monthNames, draft.endMonth)}
          </Text>

          <View style={styles.targetTabs}>
            {(['start', 'end'] as const).map((target) => {
              const active = editTarget === target
              const month = target === 'start' ? draft.startMonth : draft.endMonth
              return (
                <Pressable
                  key={target}
                  onPress={() => {
                    setEditTarget(target)
                    setViewYear(parseGraphMonthToDate(month).getFullYear())
                  }}
                  style={[
                    styles.targetTab,
                    {
                      backgroundColor: active ? colors.bgSurfaceNormal : 'transparent',
                      borderColor: active ? colors.primary : colors.borderSubtle
                    }
                  ]}
                >
                  <Text style={[styles.targetTabLabel, { color: colors.textSecondary }]}>
                    {target === 'start'
                      ? t('graph.month_range_start', '起始月')
                      : t('graph.month_range_end', '结束月')}
                  </Text>
                  <Text style={[styles.targetTabValue, { color: colors.textPrimary }]}>
                    {monthLabel(monthNames, month)}
                  </Text>
                </Pressable>
              )
            })}
          </View>

          <View style={styles.pickerBody}>
            <ScrollView style={styles.yearPane} nestedScrollEnabled>
              {years.map((y) => {
                const active = viewYear === y
                const selectedYear = parseGraphMonthToDate(activeMonth).getFullYear() === y
                return (
                  <Pressable
                    key={y}
                    onPress={() => setViewYear(y)}
                    style={[
                      styles.yearItem,
                      active && { backgroundColor: colors.primary },
                      !active && selectedYear && { backgroundColor: colors.bgSurfaceNormal }
                    ]}
                  >
                    <Text
                      style={{
                        color: active ? '#fff' : colors.textPrimary,
                        fontWeight: active || selectedYear ? '700' : '500',
                        fontSize: 13,
                        textAlign: 'center'
                      }}
                    >
                      {y}
                    </Text>
                  </Pressable>
                )
              })}
            </ScrollView>
            <View style={styles.monthPane}>
              {Array.from({ length: 12 }, (_, i) => i).map((m) => {
                const month = formatGraphMonth(new Date(viewYear, m, 1))
                const selected = activeMonth === month
                const inRange = month >= draft.startMonth && month <= draft.endMonth
                return (
                  <Pressable
                    key={month}
                    onPress={() => selectMonth(m)}
                    style={[
                      styles.monthBtn,
                      {
                        backgroundColor: selected
                          ? colors.primary
                          : inRange
                            ? colors.bgSurfaceNormal
                            : 'transparent',
                        borderColor: selected ? colors.primary : colors.borderSubtle
                      }
                    ]}
                  >
                    <Text
                      style={{
                        color: selected ? '#fff' : colors.textPrimary,
                        fontSize: 12,
                        fontWeight: selected ? '700' : '500'
                      }}
                    >
                      {Array.isArray(monthNames) ? monthNames[m] : m + 1}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          </View>

          <View style={styles.presets}>
            <Pressable
              style={[styles.presetBtn, { borderColor: colors.borderSubtle }]}
              onPress={() => applyPreset(3)}
            >
              <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 13 }}>
                {t('graph.month_range_recent3', '近3月')}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.presetBtn, { borderColor: colors.borderSubtle }]}
              onPress={() => applyPreset(6)}
            >
              <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 13 }}>
                {t('graph.month_range_recent6', '近6月')}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.presetBtn, { borderColor: colors.borderSubtle }]}
              onPress={() => applyPreset(12)}
            >
              <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 13 }}>
                {t('graph.month_range_recent12', '近1年')}
              </Text>
            </Pressable>
          </View>

          <View style={styles.footer}>
            <Pressable onPress={() => setOpen(false)} hitSlop={8}>
              <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>
                {t('common.cancel', '取消')}
              </Text>
            </Pressable>
            <Pressable onPress={applyDraft} hitSlop={8}>
              <Text style={{ color: colors.primary, fontWeight: '700' }}>
                {t('graph.month_range_apply', '应用')}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </FloatingModal>
    </>
  )
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: '100%'
  },
  triggerRange: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '600'
  },
  triggerBadge: {
    fontSize: 11,
    fontWeight: '600'
  },
  modalScroll: {
    maxHeight: 560
  },
  modalContent: {
    padding: 16,
    gap: 10
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700'
  },
  modalSubtitle: {
    fontSize: 12,
    lineHeight: 18
  },
  preview: {
    fontSize: 13,
    fontWeight: '600'
  },
  targetTabs: {
    flexDirection: 'row',
    gap: 8
  },
  targetTab: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2
  },
  targetTabLabel: {
    fontSize: 11
  },
  targetTabValue: {
    fontSize: 12,
    fontWeight: '600'
  },
  pickerBody: {
    flexDirection: 'row',
    gap: 10,
    minHeight: 180
  },
  yearPane: {
    width: 72,
    maxHeight: 200
  },
  yearItem: {
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 4
  },
  monthPane: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignContent: 'flex-start'
  },
  monthBtn: {
    width: '30%',
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth
  },
  presets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  presetBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 20,
    paddingTop: 4,
    paddingBottom: 4
  }
})
