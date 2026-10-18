import React, { useMemo, useState } from 'react'
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { FloatingModal, useNativeTheme } from '@baishou/ui/native'
import { mobileTypography, sharedTokens } from '@baishou/ui/theme/tokens'
import { graphScreenSectionStyles } from './graph-screen-section.styles'
import {
  allGraphMonthRange,
  clampGraphMonthRange,
  defaultGraphMonthRange,
  formatGraphMonth,
  graphMonthRangePresetKind,
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
export function GraphMonthRangeSheet({ value, onChange, block, style }: GraphMonthRangeSheetProps) {
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
  const presetKind = graphMonthRangePresetKind(value)
  const activeMonth = editTarget === 'start' ? draft.startMonth : draft.endMonth

  const openSheet = () => {
    setDraft(value)
    setEditTarget('start')
    setViewYear(parseGraphMonthToDate(value.startMonth).getFullYear())
    setOpen(true)
  }

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

  const applyRange = (next: GraphMonthRange) => {
    setDraft(next)
    onChange(next)
    setOpen(false)
  }

  const applyPreset = (months: number) => {
    applyRange(rangeFromMonthsBack(months))
  }

  return (
    <>
      <Pressable
        onPress={openSheet}
        unstable_pressDelay={0}
        style={[
          graphScreenSectionStyles.fieldControl,
          styles.trigger,
          {
            backgroundColor: colors.bgSurface,
            borderColor: presetKind === 'recent3' ? colors.borderSubtle : colors.primary,
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
            { color: presetKind === 'recent3' ? colors.textSecondary : colors.primary }
          ]}
        >
          {presetKind === 'recent3'
            ? t('graph.month_range_recent3', '近3月')
            : presetKind === 'all'
              ? t('graph.month_range_all', '全部')
              : t('graph.month_range_custom', '自定义')}
        </Text>
      </Pressable>

      <FloatingModal
        visible={open}
        onClose={() => setOpen(false)}
        maxWidth={420}
        animationType="none"
      >
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
                      backgroundColor: active ? colors.primaryLight : 'transparent',
                      borderColor: active ? colors.primary : colors.borderSubtle
                    }
                  ]}
                >
                  <Text
                    style={[
                      styles.targetTabLabel,
                      { color: active ? colors.primary : colors.textSecondary }
                    ]}
                  >
                    {target === 'start'
                      ? t('graph.month_range_start', '起始月')
                      : t('graph.month_range_end', '结束月')}
                  </Text>
                  <Text
                    style={[
                      styles.targetTabValue,
                      { color: active ? colors.primaryDark : colors.textPrimary }
                    ]}
                  >
                    {monthLabel(monthNames, month)}
                  </Text>
                </Pressable>
              )
            })}
          </View>

          <View style={[styles.pickerBody, { backgroundColor: colors.bgSurface }]}>
            <View style={styles.yearPane}>
              <ScrollView
                style={styles.yearScroll}
                contentContainerStyle={styles.yearScrollContent}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
              >
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
                        !active && selectedYear && { backgroundColor: colors.primaryLight }
                      ]}
                    >
                      <Text
                        style={{
                          color: active
                            ? colors.textOnPrimary
                            : selectedYear
                              ? colors.primary
                              : colors.textPrimary,
                          fontWeight: active || selectedYear ? '700' : '500',
                          fontSize: mobileTypography.secondary.fontSize,
                          textAlign: 'center'
                        }}
                      >
                        {y}
                      </Text>
                    </Pressable>
                  )
                })}
              </ScrollView>
            </View>
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
                            ? colors.primaryLight
                            : 'transparent',
                        borderColor: selected ? colors.primary : 'transparent'
                      }
                    ]}
                  >
                    <Text
                      style={{
                        color: selected
                          ? colors.textOnPrimary
                          : inRange
                            ? colors.primary
                            : colors.textPrimary,
                        fontSize: mobileTypography.caption.fontSize,
                        fontWeight: selected ? '700' : inRange ? '600' : '500',
                        textAlign: 'center'
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
              <Text
                style={{
                  color: colors.primary,
                  fontWeight: '600',
                  fontSize: mobileTypography.secondary.fontSize
                }}
              >
                {t('graph.month_range_recent3', '近3月')}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.presetBtn, { borderColor: colors.borderSubtle }]}
              onPress={() => applyPreset(6)}
            >
              <Text
                style={{
                  color: colors.primary,
                  fontWeight: '600',
                  fontSize: mobileTypography.secondary.fontSize
                }}
              >
                {t('graph.month_range_recent6', '近6月')}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.presetBtn, { borderColor: colors.borderSubtle }]}
              onPress={() => applyPreset(12)}
            >
              <Text
                style={{
                  color: colors.primary,
                  fontWeight: '600',
                  fontSize: mobileTypography.secondary.fontSize
                }}
              >
                {t('graph.month_range_recent12', '近1年')}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.presetBtn, { borderColor: colors.borderSubtle }]}
              onPress={() => applyRange(allGraphMonthRange())}
            >
              <Text
                style={{
                  color: colors.primary,
                  fontWeight: '600',
                  fontSize: mobileTypography.secondary.fontSize
                }}
              >
                {t('graph.month_range_all', '全部')}
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
              <Text style={{ color: colors.primary, fontWeight: '600' }}>
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
    justifyContent: 'center',
    gap: sharedTokens.spacing.sm,
    maxWidth: '100%'
  },
  triggerRange: {
    flexShrink: 1,
    fontSize: mobileTypography.caption.fontSize,
    fontWeight: '600',
    textAlign: 'center'
  },
  triggerBadge: {
    fontSize: mobileTypography.caption.fontSize,
    fontWeight: '600',
    textAlign: 'center'
  },
  modalScroll: {
    maxHeight: 560
  },
  modalContent: {
    padding: sharedTokens.spacing.md,
    gap: sharedTokens.spacing.smPlus
  },
  modalTitle: {
    fontSize: mobileTypography.primary.fontSize,
    fontWeight: '600'
  },
  modalSubtitle: {
    fontSize: mobileTypography.caption.fontSize,
    lineHeight: 18
  },
  preview: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '600'
  },
  targetTabs: {
    flexDirection: 'row',
    gap: sharedTokens.spacing.sm
  },
  targetTab: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: sharedTokens.radius.control,
    paddingHorizontal: sharedTokens.spacing.smPlus,
    paddingVertical: sharedTokens.spacing.sm,
    gap: sharedTokens.spacing.xxs
  },
  targetTabLabel: {
    fontSize: mobileTypography.caption.fontSize
  },
  targetTabValue: {
    fontSize: mobileTypography.caption.fontSize,
    fontWeight: '600'
  },
  pickerBody: {
    flexDirection: 'row',
    gap: sharedTokens.spacing.smPlus,
    minHeight: 180
  },
  yearPane: {
    width: sharedTokens.spacing.xxl,
    maxWidth: sharedTokens.spacing.xxl,
    maxHeight: 200,
    flexGrow: 0,
    flexShrink: 0
  },
  yearScroll: {
    maxHeight: 200,
    flexGrow: 0,
    flexShrink: 0
  },
  yearScrollContent: {
    alignItems: 'stretch'
  },
  yearItem: {
    paddingVertical: sharedTokens.spacing.sm,
    borderRadius: sharedTokens.radius.sm,
    marginBottom: sharedTokens.spacing.xs,
    alignItems: 'center',
    justifyContent: 'center'
  },
  monthPane: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: sharedTokens.spacing.xsPlus,
    alignContent: 'flex-start'
  },
  monthBtn: {
    width: '31%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: sharedTokens.spacing.smPlus,
    borderRadius: sharedTokens.radius.sm,
    borderWidth: StyleSheet.hairlineWidth
  },
  presets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: sharedTokens.spacing.sm
  },
  presetBtn: {
    paddingHorizontal: sharedTokens.spacing.mdTight,
    paddingVertical: sharedTokens.spacing.sm,
    borderRadius: sharedTokens.radius.sm,
    borderWidth: StyleSheet.hairlineWidth
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: sharedTokens.spacing.mdPlus,
    paddingTop: sharedTokens.spacing.xs,
    paddingBottom: sharedTokens.spacing.xs
  }
})
