import React, { memo, useEffect, useMemo, useState } from 'react'
import { View, Text, StyleSheet, useColorScheme } from 'react-native'
import { SvgXml } from 'react-native-svg'
import { useNativeTheme } from '../theme'
import {
  getCachedProviderIconXml,
  getProviderIconModule,
  hasProviderIcon,
  resolveProviderIconXml
} from '../../utils/provider-icons.native'

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
  const iconModule = useMemo(
    () => getProviderIconModule(iconProviderId, isDark),
    [iconProviderId, isDark]
  )
  const [xml, setXml] = useState<string | null>(() =>
    iconModule != null ? (getCachedProviderIconXml(iconModule) ?? null) : null
  )

  useEffect(() => {
    if (iconModule == null) {
      setXml(null)
      return
    }

    const cached = getCachedProviderIconXml(iconModule)
    if (cached) {
      setXml(cached)
      return
    }

    let cancelled = false

    void resolveProviderIconXml(iconModule).then((resolved) => {
      if (!cancelled) setXml(resolved)
    })

    return () => {
      cancelled = true
    }
  }, [iconModule])

  const wrapSize = size + 8
  const showBrandSvg = Boolean(xml)
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
        <SvgXml xml={xml!} width={size} height={size} />
      ) : showLetterFallback ? (
        <Text style={[styles.fallback, { color: colors.primary, fontSize: size * 0.55 }]}>
          {providerId.slice(0, 2).toUpperCase()}
        </Text>
      ) : null}
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
