import React, { memo, useMemo } from 'react'
import { View, Text, StyleSheet, useColorScheme } from 'react-native'
import { useNativeTheme } from '../theme'
import { getProviderIconComponent, hasProviderIcon } from '../../utils/provider-icons.native'

export interface ProviderBrandIconProps {
  providerId: string
  /** 供应商类型（如 openai），在自定义 id 时用于回退匹配品牌图标 */
  providerType?: string
  size?: number
}

function resolveIconProviderId(providerId: string, providerType?: string): string {
  if (hasProviderIcon(providerId)) return providerId
  if (providerType && hasProviderIcon(providerType)) return providerType
  return providerId
}

const ProviderBrandIconInner: React.FC<ProviderBrandIconProps> = ({
  providerId,
  providerType,
  size = 22
}) => {
  const { colors } = useNativeTheme()
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const iconProviderId = useMemo(
    () => resolveIconProviderId(providerId, providerType),
    [providerId, providerType]
  )
  const Icon = useMemo(
    () => getProviderIconComponent(iconProviderId, isDark),
    [iconProviderId, isDark]
  )

  const wrapSize = size + 8

  return (
    <View
      style={[
        styles.wrap,
        {
          width: wrapSize,
          height: wrapSize,
          backgroundColor: '#FFFFFF',
          borderRadius: wrapSize / 4
        }
      ]}
    >
      {Icon ? (
        <Icon width={size} height={size} />
      ) : (
        <Text style={[styles.fallback, { color: colors.primary, fontSize: size * 0.55 }]}>
          {providerId.slice(0, 2).toUpperCase()}
        </Text>
      )}
    </View>
  )
}

export const ProviderBrandIcon = memo(ProviderBrandIconInner)

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  fallback: {
    fontWeight: '700'
  }
})
