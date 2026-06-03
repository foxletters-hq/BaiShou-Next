import React from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { useNativeTheme, scrollIndicatorStyle } from '@baishou/ui/native'
import { useTranslation } from 'react-i18next'
import { CompactTabHeader } from '../../components/CompactTabHeader'
import {
  SETTINGS_HUB_GROUPS,
  type SettingsHubItem,
  type SettingsHubRoute
} from './settingsHubItems'
import { QuickSettingsGroup } from './components/SettingsAccountPanel'

export const SettingsScreen: React.FC = () => {
  const { t } = useTranslation()
  const { colors, isDark, tokens } = useNativeTheme()
  const router = useRouter()

  const navigate = (route: SettingsHubRoute) => {
    if (route.type === 'section') {
      router.push(`/settings/${route.section}`)
    } else {
      router.push(route.pathname as '/assistants')
    }
  }

  const renderItem = (item: SettingsHubItem, isLast: boolean) => (
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
              {t('settings.hub_group_quick', '快捷设置')}
            </Text>
            <QuickSettingsGroup groupCardStyle={groupCardStyle} />
          </View>

          {SETTINGS_HUB_GROUPS.map((group) => (
            <View key={group.titleKey} style={styles.groupBlock}>
              <Text style={[styles.groupTitle, { color: colors.textSecondary }]}>
                {t(group.titleKey)}
              </Text>
              <View style={[styles.groupCard, groupCardStyle]}>
                {group.items.map((item, index) =>
                  renderItem(item, index === group.items.length - 1)
                )}
              </View>
            </View>
          ))}
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
    paddingBottom: 32
  },
  hub: {
    paddingHorizontal: 12,
    paddingTop: 8,
    gap: 20
  },
  groupBlock: {
    gap: 8
  },
  groupTitle: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
    marginLeft: 4,
    textTransform: 'uppercase'
  },
  groupCard: {
    overflow: 'hidden'
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 12
  },
  listItemTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500'
  },
  chevron: {
    fontSize: 20,
    lineHeight: 20
  }
})
