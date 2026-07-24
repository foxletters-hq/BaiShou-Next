import React from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '@baishou/ui/native'

interface SummaryTabBarProps {
  activeTab: 'panel' | 'gallery'
  onTabChange: (tab: 'panel' | 'gallery') => void
}

/** 回忆页顶部标签 — 与桌面「生成模式」分段滑块同款（主色实心选中） */
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
      <View style={[styles.group, { backgroundColor: colors.bgApp }]}>
        <Pressable
          style={[
            styles.btn,
            activeTab === 'panel' && {
              backgroundColor: colors.primary,
              shadowColor: '#0ea5e9',
              shadowOpacity: 0.25,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 2 },
              elevation: 2
            }
          ]}
          onPress={() => onTabChange('panel')}
        >
          <Text
            style={[
              styles.btnText,
              {
                color: activeTab === 'panel' ? colors.textOnPrimary : colors.textSecondary,
                fontWeight: activeTab === 'panel' ? '600' : '400'
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
              backgroundColor: colors.primary,
              shadowColor: '#0ea5e9',
              shadowOpacity: 0.25,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 2 },
              elevation: 2
            }
          ]}
          onPress={() => onTabChange('gallery')}
        >
          <Text
            style={[
              styles.btnText,
              {
                color: activeTab === 'gallery' ? colors.textOnPrimary : colors.textSecondary,
                fontWeight: activeTab === 'gallery' ? '600' : '400'
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
    gap: 8,
    padding: 4,
    borderRadius: 8
  },
  btn: {
    height: Math.round(12 + 13 * 1.35),
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center'
  },
  btnText: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center'
  }
})
