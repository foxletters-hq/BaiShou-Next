import React, { useCallback, useState } from 'react'
import { Modal, View, Image, StyleSheet, TouchableOpacity, Pressable, Platform } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'

interface NativeImagePreviewModalProps {
  uri: string | null
  onClose: () => void
}

export const NativeImagePreviewModal: React.FC<NativeImagePreviewModalProps> = ({
  uri,
  onClose
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const [scale, setScale] = useState(1)
  const [rotation, setRotation] = useState(0)

  const resetView = useCallback(() => {
    setScale(1)
    setRotation(0)
  }, [])

  const handleClose = useCallback(() => {
    resetView()
    onClose()
  }, [onClose, resetView])

  if (!uri) return null

  return (
    <Modal visible transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable style={styles.overlay} onPress={handleClose}>
        <View style={styles.imageWrap} pointerEvents="box-none">
          <Image
            source={{ uri }}
            style={[
              styles.image,
              {
                transform: [{ scale }, { rotate: `${rotation}deg` }]
              }
            ]}
            resizeMode="contain"
          />
        </View>

        <View
          style={[styles.toolbar, { backgroundColor: colors.bgSurface }]}
          pointerEvents="box-none"
        >
          <View style={[styles.controls, { borderColor: colors.borderSubtle }]}>
            <TouchableOpacity
              style={styles.toolBtn}
              onPress={() => setScale((s) => Math.min(s + 0.25, 3))}
              accessibilityLabel={t('image_preview.zoom_in', 'Zoom in')}
            >
              <MaterialIcons name="zoom-in" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.toolBtn}
              onPress={() => setScale((s) => Math.max(s - 0.25, 0.5))}
              accessibilityLabel={t('image_preview.zoom_out', 'Zoom out')}
            >
              <MaterialIcons name="zoom-out" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.toolBtn}
              onPress={() => setRotation((r) => r + 90)}
              accessibilityLabel={t('image_preview.rotate', 'Rotate')}
            >
              <MaterialIcons name="rotate-right" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.toolBtn}
              onPress={resetView}
              accessibilityLabel={t('image_preview.reset', 'Reset')}
            >
              <MaterialIcons name="refresh" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
            <View style={[styles.divider, { backgroundColor: colors.borderMuted }]} />
            <TouchableOpacity
              style={styles.toolBtn}
              onPress={handleClose}
              accessibilityLabel={t('common.close')}
            >
              <MaterialIcons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  imageWrap: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 56 : 40,
    paddingBottom: 100
  },
  image: {
    width: '100%',
    height: '100%'
  },
  toolbar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: Platform.OS === 'ios' ? 34 : 24,
    alignItems: 'center'
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    gap: 2
  },
  toolBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center'
  },
  divider: {
    width: 1,
    height: 22,
    marginHorizontal: 4
  }
})
