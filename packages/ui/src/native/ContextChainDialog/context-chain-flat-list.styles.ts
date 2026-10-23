import { StyleSheet } from 'react-native'
import { mobileTypography, sharedTokens } from '../../theme/tokens'

export const contextChainFlatListStyles = StyleSheet.create({
  metaRow: {
    flexDirection: 'row',
    gap: sharedTokens.spacing.sm,
    marginBottom: sharedTokens.spacing.xsPlus
  },
  metaChip: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: sharedTokens.spacing.sm,
    paddingHorizontal: sharedTokens.spacing.smPlus,
    borderRadius: sharedTokens.radius.sm,
    borderWidth: StyleSheet.hairlineWidth
  },
  compressionHint: {
    fontSize: mobileTypography.caption.fontSize,
    lineHeight: 16,
    marginBottom: sharedTokens.spacing.xsPlus,
    paddingHorizontal: sharedTokens.spacing.xs,
    fontWeight: '500'
  },
  roundHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.xsPlus,
    paddingVertical: sharedTokens.spacing.sm,
    paddingHorizontal: sharedTokens.spacing.xs,
    marginTop: sharedTokens.spacing.xs
  },
  roundChevron: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center'
  },
  roundLabel: {
    flex: 1,
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '600',
    lineHeight: 18
  },
  roundMeta: {
    fontSize: mobileTypography.caption.fontSize,
    fontWeight: '500',
    lineHeight: 16
  },
  roundBody: {
    paddingBottom: sharedTokens.spacing.xs
  },
  messageItem: {
    paddingVertical: sharedTokens.spacing.smPlus,
    paddingHorizontal: sharedTokens.spacing.xs,
    gap: sharedTokens.spacing.xsPlus
  },
  messageTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: sharedTokens.spacing.sm
  },
  roleBadge: {
    paddingHorizontal: sharedTokens.spacing.sm,
    paddingVertical: sharedTokens.spacing.xxs,
    borderRadius: sharedTokens.radius.xs
  },
  roleBadgeText: {
    fontSize: mobileTypography.caption.fontSize,
    fontWeight: '600',
    lineHeight: 16
  },
  messagePreview: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '400',
    lineHeight: 20
  }
})
