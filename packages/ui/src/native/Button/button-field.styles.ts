import type { TextStyle, ViewStyle } from 'react-native'
import type { ButtonVariant } from 'heroui-native'
import type { lightColors } from '../../theme'
import { mobileTypography } from '../../theme/tokens'

type ThemeColors = typeof lightColors

export function isCompactButtonSize(size?: string): boolean {
  return size === 'sm' || size === 'small'
}

/** HeroUI Button 默认外观兜底，不依赖 Uniwind 是否生效 */
export function getHeroButtonRootStyle(
  colors: ThemeColors,
  variant: ButtonVariant,
  size?: string
): ViewStyle {
  const compact = isCompactButtonSize(size)
  const base: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: compact ? 32 : 48,
    paddingHorizontal: compact ? 12 : 16,
    paddingVertical: compact ? 6 : undefined,
    borderRadius: compact ? 8 : 24,
    borderCurve: 'continuous',
    gap: compact ? 6 : 8,
    alignSelf: compact ? 'flex-start' : undefined,
    flexShrink: compact ? 0 : undefined
  }

  const surfaceOutline: ViewStyle = {
    ...base,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderControl
  }

  switch (variant) {
    case 'primary':
    case 'outline':
      return surfaceOutline
    case 'secondary':
    case 'tertiary':
      return { ...base, backgroundColor: colors.bgSurfaceHighest }
    case 'ghost':
      return { ...base, backgroundColor: 'transparent' }
    case 'danger':
      return { ...base, backgroundColor: colors.error }
    case 'danger-soft':
      return { ...base, backgroundColor: colors.errorContainer }
    default:
      return surfaceOutline
  }
}

export function getHeroButtonLabelStyle(
  colors: ThemeColors,
  variant: ButtonVariant,
  labelClassName?: string,
  fontFamily?: string,
  size?: string
): TextStyle {
  const compact = isCompactButtonSize(size)
  const base: TextStyle = {
    fontSize: compact ? mobileTypography.secondary.fontSize : mobileTypography.body.fontSize,
    fontWeight: compact ? '500' : '600',
    ...(fontFamily ? { fontFamily } : {})
  }

  if (labelClassName?.includes('text-danger')) {
    return { ...base, color: colors.error }
  }

  switch (variant) {
    case 'primary':
    case 'outline':
      return { ...base, color: colors.textPrimary }
    case 'danger':
      return { ...base, color: colors.onError ?? colors.textOnPrimary }
    case 'danger-soft':
      return { ...base, color: colors.onErrorContainer ?? colors.error }
    case 'ghost':
    case 'tertiary':
      return { ...base, color: colors.textPrimary }
    case 'secondary':
      return { ...base, color: colors.textPrimary }
    default:
      return { ...base, color: colors.textPrimary }
  }
}
