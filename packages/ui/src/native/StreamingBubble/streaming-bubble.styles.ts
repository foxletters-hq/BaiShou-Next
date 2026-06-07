import { StyleSheet, type ViewStyle, type TextStyle } from 'react-native'
import type { useNativeTheme } from '../theme'

export function createStreamingBubbleStyles(
  colors: ReturnType<typeof useNativeTheme>['colors'],
  tokens: ReturnType<typeof useNativeTheme>['tokens']
) {
  const row: ViewStyle = {
    flexDirection: 'row',
    padding: tokens.spacing.md,
    gap: tokens.spacing.sm
  }

  const avatar: ViewStyle = {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: tokens.spacing.sm
  }

  const avatarEmoji: TextStyle = { fontSize: 18 }

  const aiName: TextStyle = {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: tokens.spacing.xs
  }

  const bubbleCard: ViewStyle = {
    backgroundColor: colors.bgSurface,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    width: '100%',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8
  }

  const dotsWrap: ViewStyle = {
    paddingHorizontal: 4
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
    row,
    avatar,
    avatarEmoji,
    content: { flex: 1, maxWidth: '92%' },
    aiName,
    bubbleCard,
    dotsWrap,
    errorBox,
    errorText
  })
}

export type StreamingBubbleStyles = ReturnType<typeof createStreamingBubbleStyles>
