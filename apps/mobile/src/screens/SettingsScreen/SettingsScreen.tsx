import React from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import {
  useNativeTheme,
  scrollIndicatorStyle,
  SettingsNavIcon,
  SettingsListLeadingIcon
} from '@baishou/ui/native'
import { useTranslation } from 'react-i18next'
import { iconSizes, mobileTypography, sharedTokens } from '@baishou/ui/theme/tokens'
import { CompactTabHeader } from '../../components/CompactTabHeader'
import {
  SETTINGS_HUB_GROUPS,
  type SettingsHubItem,
  type SettingsHubRoute
} from './settingsHubItems'
import { QuickSettingsGroup } from './components/SettingsAccountPanel'
import { SettingsAboutGroup } from './components/SettingsAboutGroup'
import { StorageSettingsInline } from './components/StorageSettingsInline'

export const SettingsScreen: React.FC = () => {
  const { t } = useTranslation()
  const { colors, isDark, tokens } = useNativeTheme()
  const router = useRouter()

  const navigate = (route: SettingsHubRoute) => {
    if (route.type === 'section') {
      router.push(`/settings/${route.section}`)
    } else if (route.type === 'stack') {
      router.push(route.pathname)
    }
  }

  const renderHubItem = (item: SettingsHubItem, index: number, groupLength: number) => {
    const isLast = index === groupLength - 1

    if (item.route.type === 'inline' && item.route.id === 'storage') {
      return <StorageSettingsInline key={item.id} embedded isLast={isLast} />
    }

    return renderNavItem(item, isLast)
  }

  const renderNavItem = (item: SettingsHubItem, isLast: boolean) => (
    <TouchableOpacity
      key={item.id}
      style={[
        styles.listItem,
        !isLast && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.borderSubtle
        }
      ]}
      onPress={() => navigate(item.route)}
      activeOpacity={0.65}
    >
      <SettingsListLeadingIcon>
        <SettingsNavIcon id={item.icon} size={18} color={colors.textSecondary} />
      </SettingsListLeadingIcon>
      <Text style={[styles.listItemTitle, { color: colors.textPrimary }]} numberOfLines={1}>
        {t(item.titleKey)}
      </Text>
      <Text style={[styles.chevron, { color: colors.textTertiary }]}>›</Text>
    </TouchableOpacity>
  )

  const groupCardStyle = {
    backgroundColor: colors.bgSurface,
    borderRadius: tokens.radius.lg
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bgApp }]}>
      <CompactTabHeader title={t('settings.title')} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        indicatorStyle={scrollIndicatorStyle(isDark)}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
      >
        <View style={styles.hub}>
          <View style={styles.groupBlock}>
            <Text style={[styles.groupTitle, { color: colors.textSecondary }]}>
              {t('settings.hub_group_quick', '个人资料')}
            </Text>
            <QuickSettingsGroup groupCardStyle={groupCardStyle} />
          </View>

          {SETTINGS_HUB_GROUPS.map((group) => (
            <View key={group.titleKey} style={styles.groupBlock}>
              <Text style={[styles.groupTitle, { color: colors.textSecondary }]}>
                {t(group.titleKey)}
              </Text>
              <View style={[styles.groupCard, groupCardStyle]}>
                {group.items.map((item, index) => renderHubItem(item, index, group.items.length))}
              </View>
            </View>
          ))}

          <SettingsAboutGroup groupCardStyle={groupCardStyle} />
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  scroll: {
    flex: 1
  },
  scrollContent: {
    paddingBottom: sharedTokens.spacing.xl
  },
  hub: {
    paddingHorizontal: sharedTokens.spacing.mdTight,
    paddingTop: sharedTokens.spacing.sm,
    gap: sharedTokens.spacing.mdPlus
  },
  groupBlock: {
    gap: sharedTokens.spacing.sm
  },
  groupTitle: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: mobileTypography.secondary.fontWeight,
    letterSpacing: 0.3,
    marginLeft: sharedTokens.spacing.xs,
    textTransform: 'uppercase'
  },
  groupCard: {
    overflow: 'hidden'
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: sharedTokens.spacing.mdSnug,
    paddingVertical: sharedTokens.spacing.mdSnug,
    gap: sharedTokens.spacing.mdTight
  },
  listItemTitle: {
    flex: 1,
    fontSize: mobileTypography.primary.fontSize,
    fontWeight: mobileTypography.primary.fontWeight
  },
  chevron: {
    fontSize: iconSizes.md,
    lineHeight: 20
  }
})
