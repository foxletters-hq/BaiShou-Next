import type { TextStyle, ViewStyle } from 'react-native'
import type { ButtonVariant } from 'heroui-native'
import type { lightColors } from '../../theme'

type ThemeColors = typeof lightColors

/** HeroUI Button 默认外观兜底，不依赖 Uniwind 是否生效 */
export function getHeroButtonRootStyle(colors: ThemeColors, variant: ButtonVariant): ViewStyle {
  const base: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: 24,
    borderCurve: 'continuous',
    gap: 8
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
  labelClassName?: string
): TextStyle {
  const base: TextStyle = {
    fontSize: 15,
    fontWeight: '600'
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
