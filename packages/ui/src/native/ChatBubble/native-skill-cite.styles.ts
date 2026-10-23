import { StyleSheet } from 'react-native'
import { mobileTypography, sharedTokens } from '../../theme/tokens'

export const nativeSkillCiteStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: sharedTokens.spacing.sm,
    marginBottom: sharedTokens.spacing.xsPlus
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.xs,
    paddingLeft: sharedTokens.spacing.sm,
    paddingRight: sharedTokens.spacing.sm,
    paddingVertical: sharedTokens.spacing.xs,
    borderLeftWidth: 2,
    maxWidth: '100%'
  },
  label: {
    fontSize: mobileTypography.body.fontSize,
    fontWeight: '500'
  }
})
