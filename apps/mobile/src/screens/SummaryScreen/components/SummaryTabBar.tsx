import React from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { MaterialIcons } from '@expo/vector-icons'
import { useNativeTheme } from '@baishou/ui/native'

interface SummaryTabBarProps {
  activeTab: 'panel' | 'gallery'
  onTabChange: (tab: 'panel' | 'gallery') => void
}

/** 与桌面 SummaryTabBar 对齐的 Tab 栏 */
export const SummaryTabBar: React.FC<SummaryTabBarProps> = ({ activeTab, onTabChange }) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()

  return (
    <View
      style={[
        styles.header,
        {
          backgroundColor: colors.bgGlassSurface ?? colors.bgSurface,
          borderBottomColor: colors.borderMuted
        }
      ]}
    >
      <View style={[styles.tabs, { backgroundColor: colors.bgSurfaceNormal }]}>
        <Pressable
          style={[
            styles.tab,
            activeTab === 'panel' && {
              backgroundColor: colors.bgSurface,
              shadowColor: '#000',
              shadowOpacity: 0.06,
              shadowRadius: 4,
              shadowOffset: { width: 0, height: 1 },
              elevation: 2
            }
          ]}
          onPress={() => onTabChange('panel')}
        >
          <MaterialIcons
            name="dashboard"
            size={18}
            color={activeTab === 'panel' ? colors.primary : colors.textSecondary}
          />
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'panel' ? colors.primary : colors.textSecondary }
            ]}
          >
            {t('summary.panel_tab')}
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.tab,
            activeTab === 'gallery' && {
              backgroundColor: colors.bgSurface,
              shadowColor: '#000',
              shadowOpacity: 0.06,
              shadowRadius: 4,
              shadowOffset: { width: 0, height: 1 },
              elevation: 2
            }
          ]}
          onPress={() => onTabChange('gallery')}
        >
          <MaterialIcons
            name="layers"
            size={18}
            color={activeTab === 'gallery' ? colors.primary : colors.textSecondary}
          />
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'gallery' ? colors.primary : colors.textSecondary }
            ]}
          >
            {t('summary.memory_gallery')}
          </Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1
  },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    padding: 6,
    borderRadius: 12,
    alignSelf: 'stretch',
    width: '100%'
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8
  },
  tabText: {
    fontSize: 14,
    fontWeight: '700'
  }
})
