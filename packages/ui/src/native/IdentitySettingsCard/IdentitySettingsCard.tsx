import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { IdCard } from 'lucide-react-native'
import { useNativeTheme } from '../theme'
import type { NativeIdentitySettingsCardProps } from './identity-settings.types'
import { SettingsListLeadingIcon } from '../settings/SettingsListLeadingIcon'
import { settingsHubListStyles as hubStyles } from '../settings/settings-hub.styles'
import { DEFAULT_STROKE_WIDTH, NAV_ICON_SIZE } from '../../shared/icons/icon-sizes'

export const IdentitySettingsCard: React.FC<NativeIdentitySettingsCardProps> = ({
  profile,
  onManageIdentity
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const activeId = profile.activePersonaId || ''

  return (
    <Pressable
      onPress={() => onManageIdentity?.()}
      disabled={!onManageIdentity}
      style={({ pressed }) => [
        hubStyles.row,
        { opacity: !onManageIdentity ? 0.45 : pressed ? 0.7 : 1 }
      ]}
      accessibilityRole="button"
      accessibilityLabel={t('settings.identity_card')}
    >
      <SettingsListLeadingIcon>
        <IdCard
          size={NAV_ICON_SIZE}
          strokeWidth={DEFAULT_STROKE_WIDTH}
          color={colors.textSecondary}
        />
      </SettingsListLeadingIcon>
      <View style={{ flex: 1 }}>
        <Text style={[hubStyles.rowTitle, { color: colors.textPrimary }]}>
          {t('settings.identity_card')}
        </Text>
        <Text style={{ color: colors.textSecondary, marginTop: 2, fontSize: 14 }}>
          {t('settings.identity_current_named', { name: activeId })}
        </Text>
      </View>
      <Text style={[hubStyles.hubChevron, { color: colors.textTertiary }]}>›</Text>
    </Pressable>
  )
}
