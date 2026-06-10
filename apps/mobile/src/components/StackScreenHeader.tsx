import React, { useMemo } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, type ViewStyle } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '@baishou/ui/native'
import { StackScreenHeaderAction } from './StackScreenHeaderAction'
import type { StackScreenHeaderActionConfig } from './stack-screen-header.types'

export type { StackScreenHeaderActionConfig } from './stack-screen-header.types'

export interface StackScreenHeaderProps {
  title: string
  showBack?: boolean
  onBack?: () => void
  headerRight?: StackScreenHeaderActionConfig
  rightAction?: React.ReactNode
  style?: ViewStyle
  /** false：白色顶栏条（默认）；true：与内容区同色、无顶栏底边 */
  transparent?: boolean
}

export const StackScreenHeader: React.FC<StackScreenHeaderProps> = ({
  title,
  showBack = true,
  onBack,
  headerRight,
  rightAction,
  style,
  transparent = false
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const router = useRouter()

  const handleBack = onBack ?? (() => router.back())

  const resolvedRight = useMemo(() => {
    if (rightAction !== undefined) return rightAction
    if (headerRight) return <StackScreenHeaderAction action={headerRight} />
    return null
  }, [headerRight, rightAction])

  const barStyle = transparent
    ? { backgroundColor: colors.bgApp, borderBottomWidth: 0 }
    : {
        backgroundColor: colors.bgSurface,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.borderSubtle
      }

  return (
    <View
      style={[
        styles.header,
        barStyle,
        !transparent && styles.headerElevated,
        !transparent && { shadowColor: colors.textPrimary },
        style
      ]}
    >
      <View style={styles.sideStart}>
        {showBack ? (
          <TouchableOpacity
            onPress={handleBack}
            hitSlop={8}
            style={styles.backHit}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
          >
            <MaterialIcons
              name="chevron-left"
              size={22}
              color={colors.textPrimary}
              style={styles.backArrow}
            />
            <Text style={[styles.backLabel, { color: colors.textSecondary }]}>
              {t('common.back')}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
        {title}
      </Text>

      <View style={styles.sideEnd}>{resolvedRight}</View>
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    minHeight: 44
  },
  headerElevated: {
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2
  },
  sideStart: {
    width: 88,
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start'
  },
  sideEnd: {
    width: 88,
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    minHeight: 40
  },
  backHit: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 8,
    paddingVertical: 4
  },
  backArrow: {
    marginLeft: -4,
    marginRight: -2
  },
  backLabel: {
    fontSize: 15,
    fontWeight: '500'
  },
  headerTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center'
  }
})
