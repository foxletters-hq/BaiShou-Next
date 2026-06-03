import React, { useEffect, useMemo, useState } from 'react'
import { View, Text, StyleSheet, useColorScheme } from 'react-native'
import { SvgUri } from 'react-native-svg'
import { Asset } from 'expo-asset'
import { useNativeTheme } from '@baishou/ui/native'
import { getProviderIconModule, hasProviderIcon } from '../../../utils/provider-icons'

interface ProviderBrandIconProps {
  providerId: string
  size?: number
}

export const ProviderBrandIcon: React.FC<ProviderBrandIconProps> = ({
  providerId,
  size = 22
}) => {
  const { colors } = useNativeTheme()
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const iconModule = useMemo(
    () => getProviderIconModule(providerId, isDark),
    [providerId, isDark]
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

  const wrapSize = size + 12
  const showBrandSvg = Boolean(uri)
  const showLetterFallback = !hasProviderIcon(providerId)

  return (
    <View
      style={[
        styles.wrap,
        {
          width: wrapSize,
          height: wrapSize,
          backgroundColor: colors.bgSurfaceNormal,
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
