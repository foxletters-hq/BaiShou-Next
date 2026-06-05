import type { lightColors } from '../../theme'

type ThemeColors = typeof lightColors

/** 与 heroui-native slider.styles 默认水平尺寸一致 */
export const HERO_SLIDER_TRACK_HEIGHT = 20
export const HERO_SLIDER_THUMB_WIDTH = 28
export const HERO_SLIDER_THUMB_HEIGHT = 20
export const HERO_SLIDER_THUMB_PADDING = 2
export const HERO_SLIDER_RADIUS = 12

export interface NativeSliderThumbOptions {
  /** 拇指外圈色；默认主题 primary */
  thumbColor?: string
  /** 拇指内芯色；默认白色 */
  thumbKnobColor?: string
}

export function getHeroSliderTrackStyle(
  colors: ThemeColors,
  trackColor?: string
): { width: '100%'; height: number; borderRadius: number; backgroundColor: string } {
  return {
    width: '100%',
    height: HERO_SLIDER_TRACK_HEIGHT,
    borderRadius: HERO_SLIDER_RADIUS,
    backgroundColor: trackColor ?? colors.bgSurfaceNormal ?? colors.borderMuted
  }
}

export function getHeroSliderFillStyle(colors: ThemeColors, fillColor?: string) {
  return {
    position: 'absolute' as const,
    top: 0,
    bottom: 0,
    borderRadius: HERO_SLIDER_RADIUS,
    backgroundColor: fillColor ?? colors.primary
  }
}

export function getHeroSliderThumbStyles(
  colors: ThemeColors,
  options: NativeSliderThumbOptions = {}
) {
  const ring = options.thumbColor ?? colors.primary
  const knob = options.thumbKnobColor ?? '#FFFFFF'

  return {
    thumbContainer: {
      position: 'absolute' as const,
      top: 0,
      width: HERO_SLIDER_THUMB_WIDTH,
      height: HERO_SLIDER_THUMB_HEIGHT,
      borderRadius: HERO_SLIDER_RADIUS,
      padding: HERO_SLIDER_THUMB_PADDING,
      backgroundColor: ring
    },
    thumbKnob: {
      flex: 1 as const,
      borderRadius: HERO_SLIDER_RADIUS - HERO_SLIDER_THUMB_PADDING,
      backgroundColor: knob
    }
  }
}
