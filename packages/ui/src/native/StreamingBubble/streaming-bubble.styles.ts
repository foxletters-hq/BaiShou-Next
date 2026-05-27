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

  const bubble: ViewStyle = {
    backgroundColor: colors.bgSurface,
    borderRadius: tokens.radius.lg,
    padding: tokens.spacing.md,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2
  }

  const reasoningBox: ViewStyle = {
    backgroundColor: colors.bgSurfaceNormal,
    borderRadius: tokens.radius.md,
    padding: tokens.spacing.sm,
    marginBottom: tokens.spacing.sm
  }

  const reasoningTitle: TextStyle = {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: tokens.spacing.xs
  }

  const reasoningText: TextStyle = {
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 20
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

  const dotsRow: ViewStyle = {
    flexDirection: 'row',
    gap: 6,
    padding: tokens.spacing.md
  }

  const dot: ViewStyle = {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.textSecondary,
    opacity: 0.5
  }

  return StyleSheet.create({
    row,
    avatar,
    avatarEmoji,
    content: { flex: 1 },
    aiName,
    bubble,
    reasoningBox,
    reasoningTitle,
    reasoningText,
    errorBox,
    errorText,
    dotsRow,
    dot
  })
}

export type StreamingBubbleStyles = ReturnType<typeof createStreamingBubbleStyles>
