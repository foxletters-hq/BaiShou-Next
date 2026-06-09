import React, { useEffect, useMemo, useState } from 'react'
import { View, Text, StyleSheet, useColorScheme } from 'react-native'
import { SvgUri } from 'react-native-svg'
import { Asset } from 'expo-asset'
import { useNativeTheme } from '../theme'
import { getProviderIconModule, hasProviderIcon } from '../../utils/provider-icons.native'

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

export const ProviderBrandIcon: React.FC<ProviderBrandIconProps> = ({
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
  const iconModule = useMemo(
    () => getProviderIconModule(iconProviderId, isDark),
    [iconProviderId, isDark]
  )
  const [uri, setUri] = useState<string | null>(null)

  useEffect(() => {
    if (iconModule == null) {
      setUri(null)
      return
    }

    let cancelled = false
    const asset = Asset.fromModule(iconModule)

    void (async () => {
      try {
        if (!asset.localUri) {
          await asset.downloadAsync()
        }
        if (!cancelled) {
          setUri(asset.localUri ?? asset.uri)
        }
      } catch {
        if (!cancelled) setUri(null)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [iconModule])

  const wrapSize = size + 8
  const showBrandSvg = Boolean(uri)
  const showLetterFallback = !hasProviderIcon(iconProviderId)

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
      {showBrandSvg ? (
        <SvgUri uri={uri!} width={size} height={size} />
      ) : showLetterFallback ? (
        <Text style={[styles.fallback, { color: colors.primary, fontSize: size * 0.55 }]}>
          {providerId.slice(0, 2).toUpperCase()}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  fallback: {
    fontWeight: '700'
  }
})
