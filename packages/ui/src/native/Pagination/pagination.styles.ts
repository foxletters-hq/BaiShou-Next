import { StyleSheet } from 'react-native'
import { mobileTypography, sharedTokens } from '../../theme/tokens'

export const paginationStyles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sharedTokens.spacing.xs
  },
  pageBtn: {
    minWidth: 32,
    height: 32,
    paddingHorizontal: sharedTokens.spacing.xsPlus,
    borderRadius: sharedTokens.radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  pageBtnActive: {},
  pageBtnText: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '500'
  },
  pageBtnTextActive: {
    fontWeight: '600'
  },
  ellipsis: {
    minWidth: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center'
  },
  ellipsisText: {
    fontSize: mobileTypography.secondary.fontSize,
    letterSpacing: 2
  },
  jumper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: sharedTokens.spacing.xs,
    gap: sharedTokens.spacing.xs,
    flexShrink: 0
  },
  jumperInput: {
    width: 40,
    height: 32,
    paddingHorizontal: sharedTokens.spacing.xs,
    paddingVertical: 0,
    textAlign: 'center',
    fontSize: mobileTypography.secondary.fontSize,
    borderWidth: 1,
    borderRadius: sharedTokens.radius.sm
  },
  jumperSuffix: {
    fontSize: mobileTypography.secondary.fontSize
  }
})
