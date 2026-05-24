import React, { useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useNativeTheme } from '../theme'

export interface ActivityHeatmapProps {
  data: Array<{ date: string; count: number }>
  year?: number
}

const MONTH_LABELS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
const DAY_LABELS = ['一', '三', '五']

const getISOWeek = (date: Date): number => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

const getColorForCount = (count: number, colors: any): string => {
  if (count === 0) return colors.bgSurfaceNormal
  if (count <= 2) return colors.primary + '33'
  if (count <= 5) return colors.primary + '80'
  if (count <= 10) return colors.primary + 'CC'
  return colors.primary
}

export const ActivityHeatmap: React.FC<ActivityHeatmapProps> = ({
  data,
  year = new Date().getFullYear()
}) => {
  const { colors } = useNativeTheme()

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
      indices.push({ label: MONTH_LABELS[month]!, index: weekIndex })
      if (month < 11) {
        const nextFirst = new Date(year, month + 1, 1)
        const nextWeek = getISOWeek(nextFirst)
        weekIndex += Math.max(1, nextWeek - week)
      }
    }
    return indices
  }, [year])

  const maxCount = useMemo(
    () => Math.max(...data.map((d) => d.count), 1),
    [data]
  )

  return (
    <View style={[styles.container, { backgroundColor: colors.bgSurface }]}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>
        {year} 年活动热力图
      </Text>

      <View style={styles.chartArea}>
        <View style={styles.dayLabels}>
          {[0, 2, 4].map((idx) => (
            <Text
              key={idx}
              style={[styles.dayLabel, { color: colors.textTertiary }]}
            >
              {DAY_LABELS[idx / 2]}
            </Text>
          ))}
        </View>

        <View style={styles.horizontalScroll}>
          <View style={styles.monthRow}>
            {monthIndices.map((m, i) => (
              <Text
                key={i}
                style={[
                  styles.monthLabel,
                  {
                    color: colors.textTertiary,
                    left: m.index * 14 + m.index * 2
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
      </View>

      <View style={styles.legend}>
        <Text style={[styles.legendText, { color: colors.textTertiary }]}>少</Text>
        {[0, 2, 5, 10].map((level, i) => (
          <View
            key={i}
            style={[
              styles.legendCell,
              { backgroundColor: getColorForCount(level, colors) }
            ]}
          />
        ))}
        <Text style={[styles.legendText, { color: colors.textTertiary }]}>多</Text>
      </View>
    </View>
  )
}

const CELL_SIZE = 13
const CELL_GAP = 2

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderRadius: 12
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12
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
    flex: 1,
    overflow: 'hidden'
  },
  monthRow: {
    height: 18,
    position: 'relative'
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
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    gap: 4
  },
  legendText: {
    fontSize: 10,
    marginHorizontal: 4
  },
  legendCell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 2
  }
})
