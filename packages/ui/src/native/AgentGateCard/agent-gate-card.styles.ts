import { Platform, StyleSheet } from 'react-native'
import { mobileTypography, sharedTokens } from '../../theme/tokens'

export const agentGateCardStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: sharedTokens.spacing.md
  },
  card: {
    borderRadius: sharedTokens.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    zIndex: 2,
    maxHeight: '86%',
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.12,
        shadowRadius: 16
      },
      default: {}
    })
  },
  header: {
    paddingHorizontal: sharedTokens.spacing.md,
    paddingTop: sharedTokens.spacing.md,
    paddingBottom: sharedTokens.spacing.mdSnug,
    gap: sharedTokens.spacing.sm
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: sharedTokens.spacing.sm
  },
  queueNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.sm
  },
  queueNavBtn: {
    width: 28,
    height: 28,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: sharedTokens.radius.xsPlus,
    alignItems: 'center',
    justifyContent: 'center'
  },
  queueLabel: {
    fontSize: mobileTypography.caption.fontSize
  },
  title: {
    fontSize: mobileTypography.primary.fontSize,
    fontWeight: '600',
    lineHeight: 22,
    flexShrink: 1
  },
  description: {
    fontSize: mobileTypography.secondary.fontSize,
    lineHeight: 21
  },
  hint: {
    fontSize: mobileTypography.caption.fontSize,
    lineHeight: 18
  },
  previewBlock: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: sharedTokens.radius.control,
    paddingHorizontal: sharedTokens.spacing.mdTight,
    paddingVertical: sharedTokens.spacing.smPlus,
    gap: sharedTokens.spacing.xsPlus
  },
  diffScroll: {
    maxHeight: 220
  },
  diffText: {
    fontFamily: 'monospace',
    fontSize: mobileTypography.caption.fontSize,
    lineHeight: 16
  },
  commandText: {
    fontFamily: 'monospace',
    fontSize: mobileTypography.caption.fontSize,
    lineHeight: 18
  },
  feedbackInput: {
    minHeight: 88,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: sharedTokens.radius.control,
    paddingHorizontal: sharedTokens.spacing.mdTight,
    paddingVertical: sharedTokens.spacing.smPlus,
    textAlignVertical: 'top'
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    paddingHorizontal: sharedTokens.spacing.md,
    paddingTop: sharedTokens.spacing.mdTight,
    paddingBottom: sharedTokens.spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: sharedTokens.spacing.sm
  },
  askFooter: {
    width: '100%',
    gap: sharedTokens.spacing.sm
  },
  actionButton: {
    flexGrow: 1,
    flexBasis: 0,
    minWidth: 96
  }
})
