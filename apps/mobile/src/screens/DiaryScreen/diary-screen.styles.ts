import { StyleSheet } from 'react-native'
import { mobileTypography, sharedTokens } from '@baishou/ui/theme/tokens'

export const diaryScreenStyles = StyleSheet.create({
  safeArea: {
    flex: 1
  },
  container: {
    flex: 1,
    position: 'relative'
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    minHeight: 34,
    paddingLeft: sharedTokens.spacing.md,
    paddingRight: 96,
    paddingVertical: sharedTokens.spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth
  },
  statusItem: {
    fontSize: mobileTypography.secondary.fontSize,
    lineHeight: 18,
    fontWeight: mobileTypography.secondary.fontWeight
  },
  deleteOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: sharedTokens.spacing.lg
  },
  deleteModal: {
    width: '100%',
    maxWidth: 320,
    borderRadius: sharedTokens.radius.lg,
    padding: sharedTokens.spacing.lg
  },
  deleteTitle: {
    fontSize: mobileTypography.title.fontSize,
    fontWeight: '600',
    marginBottom: sharedTokens.spacing.mdTight
  },
  deleteContent: {
    fontSize: mobileTypography.secondary.fontSize,
    lineHeight: 20,
    marginBottom: sharedTokens.spacing.lg
  },
  deleteActions: {
    flexDirection: 'row',
    gap: sharedTokens.spacing.mdTight
  },
  deleteCancel: {
    flex: 1,
    paddingVertical: sharedTokens.spacing.mdTight,
    borderRadius: sharedTokens.radius.sm,
    alignItems: 'center'
  },
  deleteConfirm: {
    flex: 1,
    paddingVertical: sharedTokens.spacing.mdTight,
    borderRadius: sharedTokens.radius.sm,
    alignItems: 'center'
  }
})
