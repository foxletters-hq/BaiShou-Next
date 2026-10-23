import { StyleSheet } from 'react-native'
import { iconSizes, mobileTypography, sharedTokens } from '../../theme/tokens'

export const yearMonthPickerStyles = StyleSheet.create({
  triggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: sharedTokens.spacing.mdTight,
    paddingVertical: sharedTokens.spacing.sm,
    borderRadius: sharedTokens.radius.sm,
    minWidth: 120
  },
  triggerText: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '500'
  },
  triggerArrow: {
    fontSize: iconSizes.xs,
    marginLeft: sharedTokens.spacing.sm
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: sharedTokens.spacing.md
  },
  modalContent: {
    borderRadius: sharedTokens.radius.lg,
    overflow: 'hidden',
    alignSelf: 'center',
    maxHeight: '85%'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: sharedTokens.spacing.md,
    paddingVertical: sharedTokens.spacing.mdSnug,
    borderBottomWidth: 1
  },
  headerTitle: {
    fontSize: mobileTypography.primary.fontSize,
    fontWeight: '600'
  },
  closeBtn: {
    fontSize: mobileTypography.title.fontSize,
    fontWeight: '600',
    padding: sharedTokens.spacing.xs
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: sharedTokens.spacing.mdTight,
    borderTopWidth: 1,
    gap: sharedTokens.spacing.mdTight
  },
  footerBtn: {
    flex: 1,
    minWidth: 0,
    paddingVertical: sharedTokens.spacing.mdTight,
    paddingHorizontal: sharedTokens.spacing.sm,
    borderRadius: sharedTokens.radius.sm,
    alignItems: 'center',
    justifyContent: 'center'
  },
  footerBtnText: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '600'
  }
})
