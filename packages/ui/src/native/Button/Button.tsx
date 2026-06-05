import React, { forwardRef } from 'react'
import { ActivityIndicator, View, type StyleProp, type ViewStyle } from 'react-native'
import {
  Button as HeroButton,
  LinkButton,
  useButton,
  cn,
  type ButtonRootProps
} from 'heroui-native'
import { useNativeTheme } from '../theme'
import {
  resolveNativeButtonVariant,
  type LegacyButtonVariant,
  type NativeButtonVariant
} from './button.utils'
import { getHeroButtonLabelStyle, getHeroButtonRootStyle } from './button-field.styles'

export type { LegacyButtonVariant, NativeButtonVariant }
export { LinkButton, useButton }

export interface NativeButtonProps
  extends Pick<
    ButtonRootProps,
    | 'onPress'
    | 'style'
    | 'className'
    | 'accessibilityLabel'
    | 'accessibilityRole'
    | 'testID'
    | 'hitSlop'
    | 'size'
    | 'isIconOnly'
  > {
  variant?: NativeButtonVariant
  isLoading?: boolean
  /** 危险操作样式 */
  destructive?: boolean
  disabled?: boolean
  isDisabled?: boolean
  children: React.ReactNode
}

type HeroButtonRef = React.ComponentRef<typeof HeroButton>

const NativeButtonRoot = forwardRef<HeroButtonRef, NativeButtonProps>(
  (
    {
      variant = 'elevated',
      isLoading = false,
      destructive = false,
      children,
      disabled,
      isDisabled,
      className,
      style,
      ...props
    },
    ref
  ) => {
    const { colors } = useNativeTheme()
    const { variant: heroVariant, labelClassName } = resolveNativeButtonVariant(
      variant,
      destructive
    )
    const mergedDisabled = Boolean(disabled || isDisabled || isLoading)
    const rootFallback = getHeroButtonRootStyle(colors, heroVariant)
    const labelFallback = getHeroButtonLabelStyle(colors, heroVariant, labelClassName)
    const mergedStyle: StyleProp<ViewStyle> = [
      rootFallback,
      typeof style === 'function' ? undefined : style
    ]

    const renderLabel = (content: React.ReactNode) => {
      if (typeof content === 'string') {
        return (
          <HeroButton.Label className={cn(labelClassName)} style={labelFallback}>
            {content}
          </HeroButton.Label>
        )
      }
      return content
    }

    const content = isLoading ? (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8
        }}
      >
        <ActivityIndicator size="small" />
        {renderLabel(children)}
      </View>
    ) : (
      renderLabel(children)
    )

    return (
      <HeroButton
        ref={ref}
        variant={heroVariant}
        isDisabled={mergedDisabled}
        className={className}
        style={
          typeof style === 'function'
            ? (state) => [rootFallback, style(state)]
            : mergedStyle
        }
        {...props}
      >
        {content}
      </HeroButton>
    )
  }
)

NativeButtonRoot.displayName = 'NativeButton'

export const Button = Object.assign(NativeButtonRoot, {
  Label: HeroButton.Label
})
