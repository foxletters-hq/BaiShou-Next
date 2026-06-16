import React, { useEffect, useState } from 'react'
import { Image, Pressable, View, ActivityIndicator, StyleSheet, Text } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useNativeTheme } from '../theme'

function isDisplayableUri(uri: string): boolean {
  return (
    uri.startsWith('data:') ||
    uri.startsWith('http://') ||
    uri.startsWith('https://') ||
    uri.startsWith('content://')
  )
}

export interface NativeMarkdownImageProps {
  rawSrc: string
  alt?: string
  imageStyle?: object
  syncUri?: string | null
  loadImageUri?: (src: string) => Promise<string | null>
  onPress?: (rawSrc: string, resolvedUri: string) => void
}

export const NativeMarkdownImage: React.FC<NativeMarkdownImageProps> = ({
  rawSrc,
  alt,
  imageStyle,
  syncUri,
  loadImageUri,
  onPress
}) => {
  const { colors } = useNativeTheme()
  const [uri, setUri] = useState<string | null>(() => {
    if (syncUri && isDisplayableUri(syncUri)) return syncUri
    if (syncUri && !syncUri.startsWith('attachment/')) return syncUri
    return null
  })
  const [loading, setLoading] = useState(() => {
    if (syncUri && isDisplayableUri(syncUri)) return false
    if (syncUri && !syncUri.startsWith('attachment/')) return false
    return Boolean(loadImageUri || rawSrc.startsWith('attachment/'))
  })
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setFailed(false)
      if (syncUri && isDisplayableUri(syncUri)) {
        setUri(syncUri)
        setLoading(false)
        return
      }

      if (!loadImageUri) {
        if (syncUri && !syncUri.startsWith('attachment/')) {
          setUri(syncUri)
        }
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        const loaded = await loadImageUri(rawSrc)
        if (!cancelled) {
          setUri(loaded)
          setFailed(!loaded)
        }
      } catch {
        if (!cancelled) {
          setUri(null)
          setFailed(true)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [rawSrc, syncUri, loadImageUri])

  if (loading && !uri) {
    return (
      <View
        style={[
          imageStyle,
          styles.placeholder,
          { backgroundColor: colors.bgSurfaceHighest }
        ]}
      >
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    )
  }

  if (!uri) {
    if (!failed) return null
    return (
      <View
        style={[
          imageStyle,
          styles.placeholder,
          styles.failed,
          { backgroundColor: colors.bgSurfaceHighest, borderColor: colors.borderSubtle }
        ]}
      >
        <MaterialIcons name="broken-image" size={28} color={colors.textTertiary} />
        <Text style={[styles.failedText, { color: colors.textTertiary }]} numberOfLines={1}>
          {alt || rawSrc}
        </Text>
      </View>
    )
  }

  const img = (
    <Image
      source={{ uri }}
      style={imageStyle}
      resizeMode="contain"
      accessibilityLabel={alt}
      pointerEvents="none"
    />
  )

  if (!onPress) return img

  return (
    <Pressable onPress={() => onPress(rawSrc, uri)} accessibilityRole="imagebutton">
      {img}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  failed: {
    borderWidth: 1,
    padding: 12,
    gap: 8
  },
  failedText: {
    fontSize: 12
  }
})
