import React, { useState } from 'react'
import { View, Text, Pressable, Image, Modal, FlatList, Dimensions } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import type { GalleryImage } from './gallery-panel.types'
import { NUM_COLUMNS } from './gallery-panel.utils'
import { galleryPanelStyles as styles } from './gallery-panel.styles'

interface GalleryImageGridProps {
  images: GalleryImage[]
  onImagePress?: (uri: string) => void
}

export const GalleryImageGrid: React.FC<GalleryImageGridProps> = ({ images, onImagePress }) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const [fullscreenUri, setFullscreenUri] = useState<string | null>(null)

  const screenWidth = Dimensions.get('window').width
  const imageSize = (screenWidth - 32) / NUM_COLUMNS - 4

  const renderImageItem = ({ item }: { item: GalleryImage }) => (
    <Pressable
      style={[
        styles.imageWrapper,
        {
          width: imageSize,
          height: imageSize,
          backgroundColor: colors.bgSurfaceNormal,
          borderColor: colors.borderSubtle
        }
      ]}
      onPress={() => {
        if (onImagePress) {
          onImagePress(item.uri)
        } else {
          setFullscreenUri(item.uri)
        }
      }}
    >
      <Image source={{ uri: item.uri }} style={styles.image} resizeMode="cover" />
      {item.caption && (
        <View style={styles.captionBar}>
          <Text style={styles.captionText} numberOfLines={1}>
            {item.caption}
          </Text>
        </View>
      )}
    </Pressable>
  )

  if (!images || images.length === 0) {
    return (
      <View
        style={[
          styles.empty,
          {
            backgroundColor: colors.bgSurfaceNormal,
            borderColor: colors.borderSubtle
          }
        ]}
      >
        <Text style={[styles.emptyIcon, { color: colors.textTertiary }]}>🖼️</Text>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          {t('diary.no_content')}
        </Text>
      </View>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bgSurface }]}>
      <FlatList
        data={images}
        keyExtractor={(_, index) => index.toString()}
        renderItem={renderImageItem}
        numColumns={NUM_COLUMNS}
        scrollEnabled={false}
        columnWrapperStyle={styles.row}
      />

      <Modal
        visible={fullscreenUri !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setFullscreenUri(null)}
      >
        <Pressable
          style={[styles.fullscreenOverlay, { backgroundColor: colors.inverseSurface }]}
          onPress={() => setFullscreenUri(null)}
        >
          <Pressable style={styles.closeBtn} onPress={() => setFullscreenUri(null)}>
            <Text style={styles.closeBtnText}>×</Text>
          </Pressable>
          {fullscreenUri && (
            <Image
              source={{ uri: fullscreenUri }}
              style={styles.fullscreenImage}
              resizeMode="contain"
            />
          )}
        </Pressable>
      </Modal>
    </View>
  )
}
