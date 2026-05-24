import React from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  type ViewProps,
} from 'react-native'
import { useNativeTheme } from '../theme'

export interface PageSizeSelectorProps extends ViewProps {
  value: number
  options: number[]
  onChange: (size: number) => void
}

export const PageSizeSelector: React.FC<PageSizeSelectorProps> = ({
  value,
  options,
  onChange,
  style,
  ...props
}) => {
  const { colors, tokens } = useNativeTheme()

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
      style={style}
      {...props}
    >
      <View style={styles.row}>
        {options.map((option) => {
          const isSelected = option === value
          return (
            <TouchableOpacity
              key={option}
              onPress={() => onChange(option)}
              activeOpacity={0.7}
              style={[
                styles.chip,
                {
                  backgroundColor: isSelected ? colors.primary : colors.bgSurfaceNormal,
                  borderColor: isSelected ? colors.primary : colors.borderSubtle,
                },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  {
                    color: isSelected ? colors.bgSurface : colors.textPrimary,
                    fontWeight: isSelected ? ('700' as const) : ('500' as const),
                  },
                ]}
              >
                {option}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingVertical: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    minWidth: 44,
    alignItems: 'center',
  },
  chipText: {
    fontSize: 14,
  },
})
