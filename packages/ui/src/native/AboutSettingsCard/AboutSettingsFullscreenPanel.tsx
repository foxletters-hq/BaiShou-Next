import React from 'react'
import { View, Text, Pressable, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'

export interface AboutSettingsFullscreenPanelProps {
  visible: boolean
  onClose: () => void
  children: React.ReactNode
}

export const AboutSettingsFullscreenPanel: React.FC<AboutSettingsFullscreenPanelProps> = ({
  visible,
  onClose,
  children
}) => {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()

  if (!visible) {
    return null
  }

  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: colors.bgApp,
        zIndex: 100
      }}
    >
      <ScrollView style={{ flex: 1 }}>
        <View style={{ padding: tokens.spacing.md }}>
          <Pressable onPress={onClose} style={{ marginBottom: tokens.spacing.md }}>
            <Text
              style={{
                fontSize: 16,
                color: colors.primary
              }}
            >
              ← {t('common.back', '返回')}
            </Text>
          </Pressable>
          {children}
        </View>
      </ScrollView>
    </View>
  )
}
