import React from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '@baishou/ui/native'

interface SummaryTabBarProps {
  activeTab: 'panel' | 'gallery'
  onTabChange: (tab: 'panel' | 'gallery') => void
}

/** 回忆页顶部标签 — 与桌面分段滑块同款：描边轨道 + 表面选中块 */
export const SummaryTabBar: React.FC<SummaryTabBarProps> = ({ activeTab, onTabChange }) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()

  return (
    <View
      style={[
        styles.header,
        {
          backgroundColor: colors.bgSurface,
          borderBottomColor: colors.borderMuted
        }
      ]}
    >
      <View
        style={[
          styles.group,
          {
            backgroundColor: colors.bgSurfaceNormal,
            borderColor: colors.borderControl
          }
        ]}
      >
        <Pressable
          style={[
            styles.btn,
            activeTab === 'panel' && {
              backgroundColor: colors.bgSurface,
              borderColor: colors.borderSubtle
            }
          ]}
          onPress={() => onTabChange('panel')}
        >
          <Text
            style={[
              styles.btnText,
              {
                color: activeTab === 'panel' ? colors.primary : colors.textSecondary,
                fontWeight: activeTab === 'panel' ? '600' : '500'
              }
            ]}
          >
            {t('summary.panel_tab')}
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.btn,
            activeTab === 'gallery' && {
              backgroundColor: colors.bgSurface,
              borderColor: colors.borderSubtle
            }
          ]}
          onPress={() => onTabChange('gallery')}
        >
          <Text
            style={[
              styles.btnText,
              {
                color: activeTab === 'gallery' ? colors.primary : colors.textSecondary,
                fontWeight: activeTab === 'gallery' ? '600' : '500'
              }
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
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  group: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    gap: 0,
    padding: 3,
    borderRadius: 10,
    borderWidth: 1
  },
  btn: {
    height: 28,
    paddingHorizontal: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center'
  },
  btnText: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center'
  }
})
