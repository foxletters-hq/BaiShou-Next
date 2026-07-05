import React from 'react'
import { View, Text } from 'react-native'
import { useTranslation } from 'react-i18next'
import { TriangleAlert } from 'lucide-react-native'
import { useNativeTheme } from '../theme'
import { DEFAULT_STROKE_WIDTH } from '../../shared/icons/icon-sizes'
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
      <TriangleAlert size={18} color={colors.error} strokeWidth={DEFAULT_STROKE_WIDTH} />
      <Text style={[styles.disabledAlertText, { color: colors.onErrorContainer }]}>
        {t('settings.rag_disabled_alert')}
      </Text>
    </View>
  )
}
