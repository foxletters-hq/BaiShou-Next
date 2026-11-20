import React, { memo, useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useNativeTheme } from '../theme'
import { getProviderIconComponent, hasProviderIcon } from '../../utils/provider-icons.native'

export interface ProviderBrandIconProps {
  providerId: string
  /** 供应商类型（如 openai），在自定义 id 时用于回退匹配品牌图标 */
  providerType?: string
  size?: number
  /** 强制使用单色（黑白）图标版本，便于融入极简设置列表与单色卡片 */
  monochrome?: boolean
  /** 单色图标着色（默认使用主题主文字色） */
  color?: string
}

function resolveIconProviderId(providerId: string, providerType?: string): string {
  if (hasProviderIcon(providerId)) return providerId
  if (providerType && hasProviderIcon(providerType)) return providerType
  return providerId
}

const ProviderBrandIconInner: React.FC<ProviderBrandIconProps> = ({
  providerId,
  providerType,
  size = 22,
  monochrome = false,
  color
}) => {
  const { colors, isDark } = useNativeTheme()
  const iconProviderId = useMemo(
    () => resolveIconProviderId(providerId, providerType),
    [providerId, providerType]
  )
  const Icon = useMemo(
    () => getProviderIconComponent(iconProviderId, isDark, { monochrome }),
    [iconProviderId, isDark, monochrome]
  )

  const wrapSize = size + 8
  const tintColor = monochrome ? (color ?? colors.textPrimary) : color

  return (
    <View
      style={[
        styles.wrap,
        {
          width: wrapSize,
          height: wrapSize,
          backgroundColor: Icon ? 'transparent' : colors.bgSurfaceNormal,
          borderRadius: wrapSize / 4
        }
      ]}
    >
      {Icon ? (
        <Icon
          width={size}
          height={size}
          {...(tintColor ? { color: tintColor, fill: tintColor } : {})}
        />
      ) : (
        <Text
          style={[styles.fallback, { color: tintColor ?? colors.primary, fontSize: size * 0.55 }]}
        >
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
    fontWeight: '600'
  }
})
