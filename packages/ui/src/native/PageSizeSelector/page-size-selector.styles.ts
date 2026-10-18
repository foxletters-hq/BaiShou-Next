import { Platform, StyleSheet } from 'react-native'
import { mobileTypography, sharedTokens } from '../../theme/tokens'

export const pageSizeSelectorStyles = StyleSheet.create({
  wrapper: {
    position: 'relative'
  },
  triggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.xsPlus,
    height: 32,
    paddingHorizontal: sharedTokens.spacing.smPlus,
    borderRadius: sharedTokens.radius.sm,
    borderWidth: 1
  },
  pageSizeValue: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '600'
  },
  pageSizeUnit: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '400'
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: sharedTokens.spacing.lg
  },
  dropdownPanel: {
    width: '100%',
    maxWidth: 200,
    borderRadius: sharedTokens.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: sharedTokens.spacing.sm,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 16
      },
      default: {}
    })
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: sharedTokens.spacing.xs
  },
  optionBtn: {
    width: '31%',
    minWidth: 44,
    flexGrow: 1,
    height: 36,
    borderRadius: sharedTokens.radius.control,
    alignItems: 'center',
    justifyContent: 'center'
  },
  optionBtnText: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '500'
  },
  optionBtnTextSelected: {
    fontWeight: '600'
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: sharedTokens.spacing.xsPlus
  },
  footer: {
    alignItems: 'center',
    paddingVertical: sharedTokens.spacing.xxs
  },
  footerText: {
    fontSize: mobileTypography.caption.fontSize,
    fontWeight: '500'
  }
})
