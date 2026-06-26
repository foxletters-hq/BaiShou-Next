import { StyleSheet, type ViewStyle, type TextStyle } from 'react-native'
import type { useNativeTheme } from '../theme'

export function createStreamingBubbleStyles(
  colors: ReturnType<typeof useNativeTheme>['colors'],
  tokens: ReturnType<typeof useNativeTheme>['tokens']
) {
  const dotsWrap: ViewStyle = {
    paddingHorizontal: 4,
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
    fontSize: 14,
    color: colors.onErrorContainer
  }

  return StyleSheet.create({
    dotsWrap,
    errorBox,
    errorText,
    actionBarSpacer: {
      height: 38,
      marginTop: 6
    }
  })
}

export type StreamingBubbleStyles = ReturnType<typeof createStreamingBubbleStyles>
