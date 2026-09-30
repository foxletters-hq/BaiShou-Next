import { Tabs, usePathname } from 'expo-router'
import React, { useMemo } from 'react'
import { Platform, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { selectPendingCount, useAgentGateInboxStore } from '@baishou/store'
import { useNativeTheme, AppTabIcon } from '@baishou/ui/native'
import { uiTypography } from '@baishou/ui/theme/tokens'
import { HapticTab } from '../../components/haptic-tab'
import { fadeTabAnimation } from '@/src/navigation/fadeStackAnimation'

/** 图标 + 文字内容区高度（不含底部安全区） */
const TAB_BAR_CONTENT_HEIGHT = 56

export default function TabLayout() {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const insets = useSafeAreaInsets()
  const pathname = usePathname()
  const pendingGateCount = useAgentGateInboxStore(selectPendingCount)
  const agentTabActive = pathname === '/agent' || pathname.startsWith('/agent/')

  const tabBarBottomInset = Platform.OS === 'android' ? Math.max(insets.bottom, 8) : insets.bottom

  const sharedTabBarStyle = useMemo(
    () =>
      ({
        backgroundColor: colors.bgSurface,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.borderMuted,
        elevation: 0,
        shadowOpacity: 0,
        height: TAB_BAR_CONTENT_HEIGHT + tabBarBottomInset,
        paddingTop: 0,
        paddingBottom: tabBarBottomInset
      }) as const,
    [colors.bgSurface, colors.borderMuted, tabBarBottomInset]
  )

  const sharedTabBarItemStyle = useMemo(
    () =>
      ({
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 0,
        paddingBottom: 0
      }) as const,
    []
  )

  const sharedTabBarLabelStyle = useMemo(
    () =>
      Platform.select({
        ios: { fontSize: 11, marginTop: 2, marginBottom: 0 },
        android: { fontSize: 11, marginTop: 2, marginBottom: 0, includeFontPadding: false },
        default: { fontSize: 11, marginTop: 2, marginBottom: 0 }
      }),
    []
  )

  const companionTabBadgeStyle = useMemo(
    () => ({
      backgroundColor: colors.warning,
      color: colors.textPrimary,
      fontSize: uiTypography.sm,
      fontWeight: '600' as const,
      minWidth: tokens.spacing.md,
      height: tokens.spacing.md,
      lineHeight: tokens.spacing.md,
      borderRadius: tokens.radius.full,
      top: 2
    }),
    [colors.textPrimary, colors.warning, tokens.radius.full, tokens.spacing.md]
  )

  return (
    <Tabs
      detachInactiveScreens
      screenOptions={{
        ...fadeTabAnimation,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: sharedTabBarStyle,
        tabBarItemStyle: sharedTabBarItemStyle,
        tabBarLabelStyle: sharedTabBarLabelStyle,
        tabBarIconStyle: { marginBottom: 0 },
        tabBarButton: (props) => <HapticTab {...props} />,
        tabBarHideOnKeyboard: false,
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bgApp }
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('nav.diary'),
          tabBarStyle: {
            ...sharedTabBarStyle,
            backgroundColor: colors.bgSurface
          },
          tabBarIcon: ({ color }) => <AppTabIcon id="diary" color={color} />
        }}
      />
      <Tabs.Screen
        name="agent"
        options={{
          title: t('nav.agent'),
          tabBarHideOnKeyboard: false,
          tabBarBadge:
            !agentTabActive && pendingGateCount > 0
              ? pendingGateCount > 99
                ? '99+'
                : pendingGateCount
              : undefined,
          tabBarBadgeStyle: companionTabBadgeStyle,
          tabBarIcon: ({ color }) => <AppTabIcon id="agent" color={color} />
        }}
      />
      <Tabs.Screen
        name="summary"
        options={{
          title: t('summary.dashboard_title'),
          tabBarIcon: ({ color }) => <AppTabIcon id="summary" color={color} />
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('nav.settings'),
          tabBarIcon: ({ color }) => <AppTabIcon id="settings" color={color} />
        }}
      />
    </Tabs>
  )
}
