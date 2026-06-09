import React, { useMemo, useState } from 'react'
import { View, Text, StyleSheet, Pressable, Modal, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'

export interface ActivityHeatmapProps {
  data: Array<{ date: string; count: number }>
  year?: number
  availableYears?: number[]
  onYearChange?: (year: number) => void
}

const getISOWeek = (date: Date): number => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

/** 与桌面 ActivityHeatmap：空档用 surface-highest，有记录用实心 primary */
const getColorForCount = (
  count: number,
  colors: { bgSurfaceHighest?: string; bgSurfaceNormal: string; primary: string }
): string => {
  if (count === 0) return colors.bgSurfaceHighest ?? colors.bgSurfaceNormal
  return colors.primary
}

export const ActivityHeatmap: React.FC<ActivityHeatmapProps> = ({
  data,
  year = new Date().getFullYear(),
  availableYears,
  onYearChange
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const cardBorder = colors.borderMuted
  const [showYearPicker, setShowYearPicker] = useState(false)

  const MONTHS = [
    t('common.jan'),
    t('common.feb'),
    t('common.mar'),
    t('common.apr'),
    t('common.may'),
    t('common.jun'),
    t('common.jul'),
    t('common.aug'),
    t('common.sep'),
    t('common.oct'),
    t('common.nov'),
    t('common.dec')
  ]

  const DAYS = [
    t('common.sun'),
    t('common.mon'),
    t('common.tue'),
    t('common.wed'),
    t('common.thu'),
    t('common.fri'),
    t('common.sat')
  ]

  const allYears = useMemo(() => {
    if (availableYears && availableYears.length > 0) {
      return [...availableYears].sort((a, b) => a - b)
    }
    if (data.length > 0) {
      const yearSet = new Set<number>()
      data.forEach((d) => {
        const y = parseInt(d.date.substring(0, 4), 10)
        if (!isNaN(y)) yearSet.add(y)
      })
      return Array.from(yearSet).sort((a, b) => a - b)
    }
    return [new Date().getFullYear()]
  }, [data, availableYears])

  const heatmapMatrix = useMemo(() => {
    const dateMap: Record<string, number> = {}
    data.forEach((d) => {
      dateMap[d.date] = d.count
    })

    const startOfYear = new Date(year, 0, 1)
    const startDay = startOfYear.getDay() || 7
    const startWeek = getISOWeek(startOfYear)
    const endOfYear = new Date(year, 11, 31)
    const endWeek = getISOWeek(endOfYear)
    const totalWeeks = Math.max(53, endWeek - startWeek + 1)

    const grid: Array<Array<{ count: number; date: string } | null>> = []
    for (let week = 0; week < totalWeeks; week++) {
      const weekData: Array<{ count: number; date: string } | null> = []
      for (let day = 0; day < 7; day++) {
        const dayOffset = week * 7 + day - (startDay - 1)
        const currentDate = new Date(year, 0, 1 + dayOffset)
        if (currentDate.getFullYear() !== year) {
          weekData.push(null)
        } else {
          const dateStr = currentDate.toISOString().split('T')[0]!
          weekData.push({
            count: dateMap[dateStr] ?? 0,
            date: dateStr
          })
        }
      }
      grid.push(weekData)
    }

    return grid
  }, [data, year])

  const monthIndices = useMemo(() => {
    const indices: Array<{ label: string; index: number }> = []
    let weekIndex = 0
    for (let month = 0; month < 12; month++) {
      const firstDay = new Date(year, month, 1)
      const week = getISOWeek(firstDay)
      indices.push({ label: MONTHS[month]!, index: weekIndex })
      if (month < 11) {
        const nextFirst = new Date(year, month + 1, 1)
        const nextWeek = getISOWeek(nextFirst)
        weekIndex += Math.max(1, nextWeek - week)
      }
    }
    return indices
  }, [year, MONTHS])

  const totalCount = data.reduce((a, b) => a + b.count, 0)

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.bgSurface,
          borderColor: cardBorder,
          borderWidth: 1
        }
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          {year} {t('activity.yearly_records')}
        </Text>
        <View style={styles.selectors}>
          {onYearChange && (
            <Pressable
              style={[styles.yearBtn, { borderColor: colors.borderSubtle }]}
              onPress={() => setShowYearPicker(true)}
            >
              <Text style={{ color: colors.primary, fontWeight: '600' }}>
                {year}
                {t('common.year_suffix')} ▾
              </Text>
            </Pressable>
          )}
          <Text style={[styles.totalBadge, { color: colors.textSecondary }]}>
            {totalCount} {t('activity.interactions')}
          </Text>
        </View>
      </View>

      <Modal
        visible={showYearPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowYearPicker(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setShowYearPicker(false)}>
          <View style={[styles.yearModal, { backgroundColor: colors.bgSurface }]}>
            <Text style={[styles.yearModalTitle, { color: colors.textPrimary }]}>
              {t('activity.select_year')}
            </Text>
            <ScrollView contentContainerStyle={styles.yearGrid}>
              {allYears.map((y) => (
                <Pressable
                  key={y}
                  style={[
                    styles.yearOption,
                    {
                      backgroundColor: y === year ? colors.primary + '20' : colors.bgSurfaceNormal,
                      borderColor: y === year ? colors.primary : colors.borderSubtle
                    }
                  ]}
                  onPress={() => {
                    onYearChange?.(y)
                    setShowYearPicker(false)
                  }}
                >
                  <Text
                    style={{
                      color: y === year ? colors.primary : colors.textPrimary,
                      fontWeight: y === year ? '700' : '400'
                    }}
                  >
                    {y}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      <View style={styles.chartArea}>
        <View style={styles.dayLabels}>
          {DAYS.map((day, i) => (
            <Text
              key={day}
              style={[
                styles.dayLabel,
                { color: colors.textTertiary, opacity: i % 2 === 0 ? 1 : 0 }
              ]}
            >
              {day}
            </Text>
          ))}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.horizontalScroll}
        >
          <View>
            <View style={styles.monthRow}>
              {monthIndices.map((m, i) => (
                <Text
                  key={i}
                  style={[
                    styles.monthLabel,
                    {
                      color: colors.textTertiary,
                      left: m.index * (CELL_SIZE + CELL_GAP)
                    }
                  ]}
                >
                  {m.label}
                </Text>
              ))}
            </View>

            <View style={styles.grid}>
              {heatmapMatrix.map((week, wi) => (
                <View key={wi} style={styles.weekColumn}>
                  {week.map((cell, di) =>
                    cell ? (
                      <View
                        key={di}
                        style={[
                          styles.cell,
                          { backgroundColor: getColorForCount(cell.count, colors) }
                        ]}
                      />
                    ) : (
                      <View key={di} style={[styles.cell, { backgroundColor: 'transparent' }]} />
                    )
                  )}
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>
    </View>
  )
}

const CELL_SIZE = 13
const CELL_GAP = 2

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderRadius: 16,
    borderStyle: 'solid'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    flexWrap: 'wrap',
    gap: 8
  },
  title: {
    fontSize: 16,
    fontWeight: '600'
  },
  selectors: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  yearBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1
  },
  totalBadge: {
    fontSize: 13
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 24
  },
  yearModal: {
    borderRadius: 12,
    padding: 16,
    maxHeight: '60%'
  },
  yearModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12
  },
  yearGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  yearOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1
  },
  chartArea: {
    flexDirection: 'row'
  },
  dayLabels: {
    justifyContent: 'space-between',
    paddingVertical: 20,
    marginRight: 4,
    height: 7 * (CELL_SIZE + CELL_GAP)
  },
  dayLabel: {
    fontSize: 10,
    width: 14,
    textAlign: 'center'
  },
  horizontalScroll: {
    flex: 1
  },
  monthRow: {
    height: 18,
    position: 'relative',
    marginBottom: 4
  },
  monthLabel: {
    fontSize: 10,
    position: 'absolute'
  },
  grid: {
    flexDirection: 'row'
  },
  weekColumn: {
    flexDirection: 'column',
    marginRight: CELL_GAP
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 2,
    marginBottom: CELL_GAP
  }
})
