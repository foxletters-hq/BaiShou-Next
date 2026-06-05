import React from 'react'
import { View, Text, TouchableOpacity, Modal } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import { NativeSlider } from '../Slider'
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
  const colorThumb = { thumbColor: previewColor }

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
            <NativeSlider
              value={hue}
              minValue={0}
              maxValue={360}
              onChange={(v) => onHueChange(v as number)}
              fillColor={previewColor}
              thumbOptions={colorThumb}
            />
          </View>
          <View style={styles.sliderRow}>
            <Text style={[styles.sliderLabel, { color: colors.textSecondary }]}>
              {t('settings.theme_saturation', '饱和')}
            </Text>
            <NativeSlider
              value={sat}
              minValue={0}
              maxValue={100}
              onChange={(v) => onSatChange(v as number)}
              fillColor={previewColor}
              thumbOptions={colorThumb}
            />
          </View>
          <View style={styles.sliderRow}>
            <Text style={[styles.sliderLabel, { color: colors.textSecondary }]}>
              {t('settings.theme_lightness', '明度')}
            </Text>
            <NativeSlider
              value={lit}
              minValue={20}
              maxValue={90}
              onChange={(v) => onLitChange(v as number)}
              fillColor={previewColor}
              thumbOptions={colorThumb}
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
