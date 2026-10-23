import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { useNativeTheme } from '../../native/theme'
import { mobileTypography, sharedTokens } from '../../theme/tokens'

interface TokenBadgeProps {
  tokenCount: number
  costEstimate: number
  onTap?: () => void
}

export const TokenBadge: React.FC<TokenBadgeProps> = ({ tokenCount, costEstimate, onTap }) => {
  const { colors } = useNativeTheme()

  return (
    <TouchableOpacity
      onPress={onTap}
      style={[styles.container, { backgroundColor: colors.bgSurfaceHigh }]}
      activeOpacity={0.7}
    >
      <View style={[styles.dot, { backgroundColor: colors.accentGreen }]} />
      <Text style={[styles.text, { color: colors.textSecondary }]}>
        {tokenCount} tokens (~${costEstimate.toFixed(3)})
      </Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: sharedTokens.spacing.smPlus,
    paddingVertical: sharedTokens.spacing.xs,
    borderRadius: sharedTokens.radius.md
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: sharedTokens.radius.xxs,
    marginRight: sharedTokens.spacing.xsPlus
  },
  text: {
    fontSize: mobileTypography.caption.fontSize,
    fontWeight: '500'
  }
})
