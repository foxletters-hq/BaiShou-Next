import { StyleSheet, type ViewStyle, type TextStyle } from 'react-native'
import type { useNativeTheme } from '../theme'
import { mobileTypography, sharedTokens } from '../../theme/tokens'

export function createStreamingBubbleStyles(
  colors: ReturnType<typeof useNativeTheme>['colors'],
  tokens: ReturnType<typeof useNativeTheme>['tokens']
) {
  const dotsWrap: ViewStyle = {
    paddingHorizontal: sharedTokens.spacing.xs,
    alignSelf: 'stretch',
    width: '100%'
  }

  const errorBox: ViewStyle = {
    backgroundColor: colors.errorContainer,
    borderRadius: tokens.radius.md,
    padding: tokens.spacing.md,
    gap: tokens.spacing.sm
  }

  const errorText: TextStyle = {
    fontSize: mobileTypography.secondary.fontSize,
    color: colors.onErrorContainer
  }

  return StyleSheet.create({
    dotsWrap,
    errorBox,
    errorText,
    actionBarSpacer: {
      height: 38,
      marginTop: sharedTokens.spacing.xsPlus
    }
  })
}

export type StreamingBubbleStyles = ReturnType<typeof createStreamingBubbleStyles>
