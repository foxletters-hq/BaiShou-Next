import React from 'react'
import { View, Text } from 'react-native'
import { useNativeTheme } from '../theme'
import { attachmentManagementStyles as styles } from './attachment-management.styles'

interface StatItem {
  label: string
  value: string
  valueColor?: string
}

interface OverviewCardProps {
  items: StatItem[]
}

export const OverviewCard: React.FC<OverviewCardProps> = ({ items }) => {
  const { colors } = useNativeTheme()

  return (
    <View
      style={[
        styles.overviewCard,
        { backgroundColor: colors.bgSurface, borderColor: colors.borderSubtle }
      ]}
    >
      {items.map((item, index) => (
        <React.Fragment key={item.label}>
          {index > 0 && (
            <View style={[styles.statDivider, { backgroundColor: colors.borderSubtle }]} />
          )}
          <View style={styles.statColumn}>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{item.label}</Text>
            <Text
              style={[
                styles.statValue,
                { color: item.valueColor ?? colors.textPrimary }
              ]}
            >
              {item.value}
            </Text>
          </View>
        </React.Fragment>
      ))}
    </View>
  )
}
