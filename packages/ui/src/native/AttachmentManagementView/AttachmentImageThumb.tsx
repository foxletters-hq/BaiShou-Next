import React, { useEffect, useState } from 'react'
import {
  View,
  Image,
  ActivityIndicator,
  StyleSheet,
  type ImageStyle,
  type StyleProp,
  type ViewStyle
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useNativeTheme } from '../theme'
import { getFileIconName } from './attachment-management.utils'

interface AttachmentImageThumbProps {
  filePath: string
  fileName: string
  toDisplayUri: (path: string) => string
  loadImageUri?: (filePath: string, purpose?: 'thumbnail' | 'preview') => Promise<string | null>
  style?: StyleProp<ImageStyle>
  containerStyle?: StyleProp<ViewStyle>
  /** 填满父容器（日记网格卡片等大图区域） */
  fill?: boolean
}

export const AttachmentImageThumb: React.FC<AttachmentImageThumbProps> = ({
  filePath,
  fileName,
  toDisplayUri,
  loadImageUri,
  style,
  containerStyle,
  fill = false
}) => {
  const { colors } = useNativeTheme()
  const [uri, setUri] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      try {
        if (loadImageUri) {
          const loaded = await loadImageUri(filePath, 'thumbnail')
          if (!cancelled && loaded) {
            setUri(loaded)
            return
          }
        }
        if (!cancelled) {
          setUri(toDisplayUri(filePath))
        }
      } catch {
        if (!cancelled) {
          setUri(toDisplayUri(filePath))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [filePath, fileName, toDisplayUri, loadImageUri])

  return (
    <View
      style={[
        fill ? styles.containerFill : styles.container,
        !fill && { borderColor: colors.borderSubtle, backgroundColor: colors.bgApp },
        fill && { backgroundColor: colors.bgApp },
        containerStyle
      ]}
    >
      {loading && !uri ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : uri ? (
        <Image
          source={{ uri }}
          style={[styles.image, style]}
          resizeMode="cover"
          onError={() => {
            if (loadImageUri) {
              void loadImageUri(filePath, 'thumbnail').then((fallback) => {
                if (fallback) setUri(fallback)
              })
            }
          }}
        />
      ) : (
        <MaterialIcons name={getFileIconName(fileName)} size={24} color={colors.textSecondary} />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    width: 56,
    height: 56,
    borderRadius: 8,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1
  },
  containerFill: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center'
  },
  image: {
    width: '100%',
    height: '100%'
  }
})
