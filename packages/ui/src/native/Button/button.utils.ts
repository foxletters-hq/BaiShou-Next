import type { ButtonVariant } from 'heroui-native'

export type LegacyButtonVariant = 'elevated' | 'text' | 'outlined'

export type NativeButtonVariant = LegacyButtonVariant | ButtonVariant

export interface MappedButtonVariant {
  variant: ButtonVariant
  labelClassName?: string
}

export function mapLegacyButtonVariant(
  variant: LegacyButtonVariant,
  destructive: boolean
): MappedButtonVariant {
  if (destructive) {
    return { variant: 'outline', labelClassName: 'text-danger' }
  }

  return { variant: 'outline' }
}

export function resolveNativeButtonVariant(
  variant: NativeButtonVariant = 'elevated',
  destructive: boolean
): MappedButtonVariant {
  if (variant === 'elevated' || variant === 'text' || variant === 'outlined') {
    return mapLegacyButtonVariant(variant, destructive)
  }
  // 主 CTA 与桌面一致：描边表面，不用品牌实心
  if (variant === 'primary' && !destructive) {
    return { variant: 'outline' }
  }
  if (destructive && (variant === 'primary' || variant === 'secondary')) {
    return { variant: 'danger' }
  }
  return { variant }
}
