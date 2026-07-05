import React, { useEffect, useId, useMemo, useState } from 'react'
import { View, Text, TouchableOpacity, Modal } from 'react-native'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import { GradientColorSlider } from './GradientColorSlider'
import { HUE_BAR_COLORS, hexToHsl, hslToHex } from './appearance-color.utils'
import { appearanceSettingsStyles as styles } from './appearance-settings.styles'

export interface AppearanceSettingsColorModalProps {
  visible: boolean
  initialColor: string
  onClose: () => void
  onSave: (color: string) => void
}

function GradientSliderRow({
  label,
  labelColor,
  gradient,
  children
}: {
  label: string
  labelColor: string
  gradient: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <View style={styles.sliderRow}>
      <Text style={[styles.sliderLabel, { color: labelColor }]}>{label}</Text>
      <View style={styles.sliderTrackWrap}>
        <View style={styles.gradientBar} pointerEvents="none">
          {gradient}
        </View>
        {children}
      </View>
    </View>
  )
}

function SvgGradientBar({
  leftColor,
  rightColor,
  gradientId
}: {
  leftColor: string
  rightColor: string
  gradientId: string
}) {
  return (
    <Svg width="100%" height="100%" preserveAspectRatio="none">
      <Defs>
        <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0%" stopColor={leftColor} />
          <Stop offset="100%" stopColor={rightColor} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gradientId})`} rx={10} />
    </Svg>
  )
}

export const AppearanceSettingsColorModal: React.FC<AppearanceSettingsColorModalProps> = ({
  visible,
  initialColor,
  onClose,
  onSave
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const satGradientId = useId().replace(/:/g, '')
  const litGradientId = useId().replace(/:/g, '')

  const [hue, setHue] = useState(0)
  const [sat, setSat] = useState(100)
  const [lit, setLit] = useState(50)
  const [previewHue, setPreviewHue] = useState(0)
  const [previewSat, setPreviewSat] = useState(100)
  const [previewLit, setPreviewLit] = useState(50)

  useEffect(() => {
    if (!visible) return
    const parsed = hexToHsl(initialColor)
    setHue(parsed.h)
    setSat(parsed.s)
    setLit(parsed.l)
    setPreviewHue(parsed.h)
    setPreviewSat(parsed.s)
    setPreviewLit(parsed.l)
  }, [visible, initialColor])

  const previewColor = useMemo(
    () => hslToHex(previewHue, previewSat, previewLit),
    [previewHue, previewSat, previewLit]
  )

  const satLeft = useMemo(() => hslToHex(hue, 0, lit), [hue, lit])
  const satRight = useMemo(() => hslToHex(hue, 100, lit), [hue, lit])
  const litLeft = useMemo(() => hslToHex(hue, sat, 20), [hue, sat])
  const litRight = useMemo(() => hslToHex(hue, sat, 90), [hue, sat])

  const commitHue = (next: number) => {
    setHue(next)
    setPreviewHue(next)
  }
  const commitSat = (next: number) => {
    setSat(next)
    setPreviewSat(next)
  }
  const commitLit = (next: number) => {
    setLit(next)
    setPreviewLit(next)
  }

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

          <GradientSliderRow
            label={t('settings.theme_hue', '色相')}
            labelColor={colors.textSecondary}
            gradient={
              <>
                {HUE_BAR_COLORS.map((color, index) => (
                  <View
                    key={`${color}-${index}`}
                    style={[styles.hueSegment, { backgroundColor: color }]}
                  />
                ))}
              </>
            }
          >
            <GradientColorSlider
              value={hue}
              minValue={0}
              maxValue={360}
              onPreviewChange={setPreviewHue}
              onChange={commitHue}
            />
          </GradientSliderRow>

          <GradientSliderRow
            label={t('settings.theme_saturation', '饱和')}
            labelColor={colors.textSecondary}
            gradient={
              <SvgGradientBar
                gradientId={satGradientId}
                leftColor={satLeft}
                rightColor={satRight}
              />
            }
          >
            <GradientColorSlider
              value={sat}
              minValue={0}
              maxValue={100}
              onPreviewChange={setPreviewSat}
              onChange={commitSat}
            />
          </GradientSliderRow>

          <GradientSliderRow
            label={t('settings.theme_lightness', '明度')}
            labelColor={colors.textSecondary}
            gradient={
              <SvgGradientBar
                gradientId={litGradientId}
                leftColor={litLeft}
                rightColor={litRight}
              />
            }
          >
            <GradientColorSlider
              value={lit}
              minValue={20}
              maxValue={90}
              onPreviewChange={setPreviewLit}
              onChange={commitLit}
            />
          </GradientSliderRow>

          <View style={styles.modalActions}>
            <TouchableOpacity onPress={onClose} style={styles.modalBtn}>
              <Text style={[styles.modalBtnTextGray, { color: colors.textSecondary }]}>
                {t('common.cancel', '取消')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onSave(previewColor)}
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
