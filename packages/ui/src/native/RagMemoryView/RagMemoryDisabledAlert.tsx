import React from 'react'
import { View, Text } from 'react-native'
import { useTranslation } from 'react-i18next'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useNativeTheme } from '../theme'
import { ragMemoryStyles as styles } from './rag-memory.styles'

interface RagMemoryDisabledAlertProps {
  ragEnabled: boolean
}

export const RagMemoryDisabledAlert: React.FC<RagMemoryDisabledAlertProps> = ({ ragEnabled }) => {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()

  if (ragEnabled) return null

  return (
    <View
      style={[
        styles.disabledAlert,
        {
          backgroundColor: colors.bgSurfaceNormal,
          marginHorizontal: tokens.spacing.lg,
          marginBottom: tokens.spacing.sm
        }
      ]}
    >
      <MaterialCommunityIcons name="alert" size={18} color={colors.warning ?? colors.primary} />
      <Text style={[styles.disabledAlertText, { color: colors.textPrimary }]}>
        {t('settings.rag_disabled_alert')}
      </Text>
    </View>
  )
}
