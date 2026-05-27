import React from 'react'
import { View, Text, TouchableOpacity, Modal } from 'react-native'
import Slider from '@react-native-community/slider'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import { appearanceSettingsStyles as styles } from './appearance-settings.styles'

export interface AppearanceSettingsColorModalProps {
  visible: boolean
  previewColor: string
  hue: number
  sat: number
  lit: number
  onHueChange: (value: number) => void
  onSatChange: (value: number) => void
  onLitChange: (value: number) => void
  onClose: () => void
  onSave: () => void
}

export const AppearanceSettingsColorModal: React.FC<AppearanceSettingsColorModalProps> = ({
  visible,
  previewColor,
  hue,
  sat,
  lit,
  onHueChange,
  onSatChange,
  onLitChange,
  onClose,
  onSave
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={[styles.modalOverlay, { backgroundColor: colors.bgOverlay }]}>
        <View style={[styles.modalBox, { backgroundColor: colors.bgSurface }]}>
          <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
            {t('settings.custom_color', '自定义颜色')}
          </Text>

          <View
            style={[
              styles.colorPreview,
              { backgroundColor: previewColor, shadowColor: previewColor }
            ]}
          />

          <View style={styles.sliderRow}>
            <Text style={[styles.sliderLabel, { color: colors.textSecondary }]}>
              {t('settings.theme_hue', '色相')}
            </Text>
            <Slider
              style={{ flex: 1, height: 40 }}
              minimumValue={0}
              maximumValue={360}
              value={hue}
              onValueChange={onHueChange}
              minimumTrackTintColor={previewColor}
              thumbTintColor={previewColor}
            />
          </View>
          <View style={styles.sliderRow}>
            <Text style={[styles.sliderLabel, { color: colors.textSecondary }]}>
              {t('settings.theme_saturation', '饱和')}
            </Text>
            <Slider
              style={{ flex: 1, height: 40 }}
              minimumValue={0}
              maximumValue={100}
              value={sat}
              onValueChange={onSatChange}
              minimumTrackTintColor={previewColor}
              thumbTintColor={previewColor}
            />
          </View>
          <View style={styles.sliderRow}>
            <Text style={[styles.sliderLabel, { color: colors.textSecondary }]}>
              {t('settings.theme_lightness', '明度')}
            </Text>
            <Slider
              style={{ flex: 1, height: 40 }}
              minimumValue={20}
              maximumValue={90}
              value={lit}
              onValueChange={onLitChange}
              minimumTrackTintColor={previewColor}
              thumbTintColor={previewColor}
            />
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity onPress={onClose} style={styles.modalBtn}>
              <Text style={[styles.modalBtnTextGray, { color: colors.textSecondary }]}>
                {t('common.cancel', '取消')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onSave}
              style={[styles.modalBtn, { backgroundColor: colors.primary }]}
            >
              <Text style={[styles.modalBtnTextWhite, { color: colors.textOnPrimary }]}>
                {t('common.save', '保存')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}
