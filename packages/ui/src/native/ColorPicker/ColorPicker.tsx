import React, { useState } from 'react'
import { View, Text, Pressable, Modal, SafeAreaView, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'

export interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
  visible: boolean
  onClose: () => void
}

const presetColors = [
  '#9AD4EA', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE',
  '#FF8C42', '#5BA8F5', '#34D399', '#F472B6', '#A78BFA',
  '#6EE7B7', '#FCA5A5', '#93C5FD', '#C4B5FD', '#FCD34D',
  '#67E8F9', '#D8B4FE', '#FDBA74', '#86EFAC', '#F9A8D4'
]

const hueBarColors = [
  '#FF0000', '#FF9900', '#FFFF00', '#99FF00', '#00FF00',
  '#00FF99', '#00FFFF', '#0099FF', '#0000FF', '#9900FF',
  '#FF00FF', '#FF0099'
]

export const ColorPicker: React.FC<ColorPickerProps> = ({
  value,
  onChange,
  visible,
  onClose
}) => {
  const { t } = useTranslation()
  const { colors, tokens, maxModalWidth } = useNativeTheme()
  const [huePosition, setHuePosition] = useState(0.5)

  const handleHueBarPress = (event: { nativeEvent: { locationX: number } }, barWidth: number) => {
    const ratio = Math.max(0, Math.min(1, event.nativeEvent.locationX / barWidth))
    setHuePosition(ratio)
    const index = Math.floor(ratio * (hueBarColors.length - 0.01))
    onChange(hueBarColors[Math.min(index, hueBarColors.length - 1)]!)
  }

  if (!visible) return null

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={[styles.overlay, { backgroundColor: colors.overlay }]}
        onPress={onClose}
      >
        <SafeAreaView style={styles.safeArea}>
          <Pressable
            style={[
              styles.modalContent,
              {
                width: '90%',
                maxWidth: maxModalWidth,
                backgroundColor: colors.bgSurface,
                borderRadius: tokens.radius.xl,
                padding: tokens.spacing.lg
              }
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.header}>
              <View style={[styles.headerTitleRow, { gap: tokens.spacing.sm }]}>
                <Text style={styles.headerIcon}>🎨</Text>
                <Text style={[styles.headerText, { color: colors.textPrimary }]}>
                  {t('colorPicker.title', '选择颜色')}
                </Text>
              </View>
              <Pressable onPress={onClose}>
                <Text style={[styles.closeIcon, { color: colors.textSecondary }]}>×</Text>
              </Pressable>
            </View>

            {/* Preview */}
            <View style={styles.previewRow}>
              <View style={[styles.previewCircle, { backgroundColor: value }]} />
              <Text style={[styles.previewLabel, { color: colors.textSecondary }]}>{value}</Text>
            </View>

            {/* Preset Colors */}
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
              {t('colorPicker.presets', '预设颜色')}
            </Text>
            <View style={styles.colorGrid}>
              {presetColors.map((color) => (
                <Pressable
                  key={color}
                  style={[
                    styles.colorCell,
                    {
                      backgroundColor: color,
                      borderColor: value === color ? colors.primary : 'transparent'
                    }
                  ]}
                  onPress={() => onChange(color)}
                >
                  {value === color && (
                    <Text style={styles.checkMark}>✓</Text>
                  )}
                </Pressable>
              ))}
            </View>

            {/* Hue Slider */}
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
              {t('colorPicker.hue', '色相滑块')}
            </Text>
            <Pressable
              style={styles.hueBarContainer}
              onPress={(e) => {
                handleHueBarPress(e, 300)
              }}
            >
              <View style={styles.hueBar}>
                {hueBarColors.map((color, index) => (
                  <View
                    key={`${color}-${index}`}
                    style={[styles.hueSegment, { backgroundColor: color }]}
                  />
                ))}
              </View>
              <View
                style={[
                  styles.hueThumb,
                  {
                    left: `${huePosition * 100}%`,
                    backgroundColor: value
                  }
                ]}
              />
            </Pressable>
          </Pressable>
        </SafeAreaView>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  safeArea: {
    width: '100%',
    alignItems: 'center'
  },
  modalContent: {},
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  headerIcon: {
    fontSize: 20
  },
  headerText: {
    fontSize: 18,
    fontWeight: '600'
  },
  closeIcon: {
    fontSize: 24
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
    gap: 12
  },
  previewCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.1)'
  },
  previewLabel: {
    fontSize: 15,
    fontFamily: 'monospace'
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 18
  },
  colorCell: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center'
  },
  checkMark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700'
  },
  hueBarContainer: {
    height: 32,
    justifyContent: 'center',
    position: 'relative'
  },
  hueBar: {
    flexDirection: 'row',
    height: 12,
    borderRadius: 6,
    overflow: 'hidden'
  },
  hueSegment: {
    flex: 1
  },
  hueThumb: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    marginLeft: -12,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    transform: [{ translateX: 0 }]
  }
})
