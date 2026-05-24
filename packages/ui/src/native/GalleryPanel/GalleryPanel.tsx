import React, { useState } from 'react'
import {
  View,
  Text,
  Pressable,
  Image,
  Modal,
  StyleSheet,
  Dimensions,
  FlatList
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'

export interface GalleryImage {
  uri: string
  caption?: string
}

export interface GalleryPanelProps {
  images: GalleryImage[]
  onImagePress?: (uri: string) => void
}

const NUM_COLUMNS = 3

export const GalleryPanel: React.FC<GalleryPanelProps> = ({ images, onImagePress }) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const [fullscreenUri, setFullscreenUri] = useState<string | null>(null)

  const screenWidth = Dimensions.get('window').width
  const imageSize = (screenWidth - 32) / NUM_COLUMNS - 4

  const renderItem = ({ item }: { item: GalleryImage }) => (
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
      <Image
        source={{ uri: item.uri }}
        style={styles.image}
        resizeMode="cover"
      />
      {item.caption && (
        <View style={styles.captionBar}>
          <Text
            style={styles.captionText}
            numberOfLines={1}
          >
            {item.caption}
          </Text>
        </View>
      )}
    </Pressable>
  )

  if (images.length === 0) {
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
          {t('gallery.noImages', '暂无图片')}
        </Text>
      </View>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bgSurface }]}>
      <FlatList
        data={images}
        keyExtractor={(_, index) => index.toString()}
        renderItem={renderItem}
        numColumns={NUM_COLUMNS}
        scrollEnabled={false}
        columnWrapperStyle={styles.row}
      />

      {/* Fullscreen Modal */}
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

const styles = StyleSheet.create({
  container: {},
  row: {
    gap: 4,
    marginBottom: 4
  },
  imageWrapper: {
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden'
  },
  image: {
    width: '100%',
    height: '100%'
  },
  captionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  captionText: {
    color: '#FFFFFF',
    fontSize: 11
  },
  empty: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 32,
    alignItems: 'center'
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 8
  },
  emptyText: {
    fontSize: 15
  },
  fullscreenOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  fullscreenImage: {
    width: '95%',
    height: '80%'
  },
  closeBtn: {
    position: 'absolute',
    top: 40,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1
  },
  closeBtnText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '300'
  }
})
