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
    if (variant === 'elevated') {
      return { variant: 'danger' }
    }
    if (variant === 'text') {
      return { variant: 'ghost', labelClassName: 'text-danger' }
    }
    return { variant: 'outline', labelClassName: 'text-danger' }
  }

  switch (variant) {
    case 'elevated':
      return { variant: 'primary' }
    case 'outlined':
      return { variant: 'outline' }
    case 'text':
      return { variant: 'ghost' }
  }
}

export function resolveNativeButtonVariant(
  variant: NativeButtonVariant = 'elevated',
  destructive: boolean
): MappedButtonVariant {
  if (variant === 'elevated' || variant === 'text' || variant === 'outlined') {
    return mapLegacyButtonVariant(variant, destructive)
  }
  if (destructive && (variant === 'primary' || variant === 'secondary')) {
    return { variant: 'danger' }
  }
  return { variant }
}
