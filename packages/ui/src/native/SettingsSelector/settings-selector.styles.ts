import { StyleSheet } from 'react-native'
import { iconSizes, mobileControlTokens, mobileTypography, sharedTokens } from '../../theme/tokens'

export const settingsSelectorStyles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: sharedTokens.radius.md,
    paddingHorizontal: sharedTokens.spacing.mdSnug,
    paddingVertical: mobileControlTokens.inputPaddingVertical,
    minHeight: mobileControlTokens.height,
    gap: sharedTokens.spacing.sm
  },
  triggerValue: {
    flex: 1,
    fontSize: mobileTypography.secondary.fontSize,
    lineHeight: 20
  },
  chevron: {
    fontSize: iconSizes.md,
    fontWeight: '300'
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject
  },
  modalPanel: {
    borderWidth: 1,
    overflow: 'hidden',
    maxHeight: '75%',
    padding: sharedTokens.spacing.md,
    gap: sharedTokens.spacing.sm
  },
  modalOptionsList: {
    gap: sharedTokens.spacing.sm
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: sharedTokens.spacing.sm,
    paddingHorizontal: sharedTokens.spacing.md,
    paddingVertical: sharedTokens.spacing.mdTight,
    borderRadius: sharedTokens.radius.md
  },
  modalCancel: {
    paddingVertical: sharedTokens.spacing.mdTight,
    borderRadius: sharedTokens.radius.md,
    alignItems: 'center',
    justifyContent: 'center'
  }
})
