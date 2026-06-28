import React from 'react'
import { View, Text, Platform } from 'react-native'
import { useTranslation } from 'react-i18next'
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons'
import { useNativeTheme } from '../theme'
import { ragMemoryStyles as styles } from './rag-memory.styles'

interface RagMemoryDisabledAlertProps {
  ragEnabled: boolean
}

export const RagMemoryDisabledAlert: React.FC<RagMemoryDisabledAlertProps> = ({ ragEnabled }) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()

  if (ragEnabled) return null

  return (
    <View
      style={[
        styles.disabledAlert,
        {
          backgroundColor: colors.errorContainer,
          marginTop: 12
        }
      ]}
    >
      {Platform.OS === 'android' ? (
        <MaterialIcons name="warning" size={18} color={colors.error} />
      ) : (
        <MaterialCommunityIcons name="alert" size={18} color={colors.error} />
      )}
      <Text style={[styles.disabledAlertText, { color: colors.onErrorContainer }]}>
        {t('settings.rag_disabled_alert')}
      </Text>
    </View>
  )
}
