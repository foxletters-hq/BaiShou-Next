import { StyleSheet } from 'react-native'
import { mobileTypography, sharedTokens } from '../../theme/tokens'

export const incrementalSyncConfirmStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: sharedTokens.spacing.md
  },
  dialogWrap: {
    width: '100%',
    alignItems: 'center',
    zIndex: 2
  },
  dialog: {
    width: '100%',
    borderRadius: sharedTokens.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    flexDirection: 'column'
  },
  headerBlock: {
    paddingHorizontal: sharedTokens.spacing.md,
    paddingTop: sharedTokens.spacing.md,
    paddingBottom: sharedTokens.spacing.smPlus,
    gap: sharedTokens.spacing.smPlus
  },
  title: {
    fontSize: mobileTypography.title.fontSize,
    fontWeight: '600'
  },
  subtitle: {
    fontSize: mobileTypography.secondary.fontSize,
    lineHeight: 20
  },
  trafficSummary: {
    marginTop: sharedTokens.spacing.xsPlus,
    fontSize: mobileTypography.secondary.fontSize,
    lineHeight: 20
  },
  cellularWarning: {
    marginTop: sharedTokens.spacing.xs,
    fontSize: mobileTypography.caption.fontSize,
    lineHeight: 18,
    padding: sharedTokens.spacing.smPlus,
    borderRadius: sharedTokens.radius.control,
    backgroundColor: 'rgba(245, 158, 11, 0.1)'
  },
  warningItem: {
    fontSize: mobileTypography.caption.fontSize,
    lineHeight: 18,
    padding: sharedTokens.spacing.smPlus,
    borderRadius: sharedTokens.radius.control,
    backgroundColor: 'rgba(245, 158, 11, 0.1)'
  },
  scrollBody: {
    flex: 1,
    minHeight: 0
  },
  scrollContent: {
    paddingHorizontal: sharedTokens.spacing.md,
    gap: sharedTokens.spacing.smPlus,
    paddingBottom: sharedTokens.spacing.sm
  },
  vaultSection: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: sharedTokens.radius.control,
    padding: sharedTokens.spacing.smPlus,
    gap: sharedTokens.spacing.xsPlus
  },
  vaultHeader: {
    gap: sharedTokens.spacing.xs
  },
  vaultTitleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: sharedTokens.spacing.xsPlus
  },
  vaultName: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '600',
    flexShrink: 1,
    flexGrow: 1
  },
  vaultTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: sharedTokens.spacing.xsPlus
  },
  badgeActive: {
    fontSize: mobileTypography.caption.fontSize,
    fontWeight: '600'
  },
  badgeUnregistered: {
    fontSize: mobileTypography.caption.fontSize,
    fontWeight: '600'
  },
  vaultStats: {
    fontSize: mobileTypography.caption.fontSize,
    alignSelf: 'flex-end'
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: sharedTokens.spacing.sm
  },
  actionTag: {
    fontSize: mobileTypography.caption.fontSize,
    fontWeight: '600',
    paddingHorizontal: sharedTokens.spacing.xsPlus,
    paddingVertical: sharedTokens.spacing.xxs,
    borderRadius: sharedTokens.radius.xsPlus,
    overflow: 'hidden'
  },
  filePath: {
    flex: 1,
    fontSize: mobileTypography.caption.fontSize,
    lineHeight: 16
  },
  moreHint: {
    fontSize: mobileTypography.caption.fontSize
  },
  countdownHint: {
    fontSize: mobileTypography.caption.fontSize,
    textAlign: 'right'
  },
  choicePanel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: sharedTokens.radius.control,
    padding: sharedTokens.spacing.smPlus,
    gap: sharedTokens.spacing.xsPlus
  },
  choiceTitle: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '600'
  },
  choiceDesc: {
    fontSize: mobileTypography.caption.fontSize,
    lineHeight: 18
  },
  choiceMeta: {
    fontSize: mobileTypography.caption.fontSize
  },
  deleteChoiceFooter: {
    paddingHorizontal: sharedTokens.spacing.md,
    paddingTop: sharedTokens.spacing.mdTight,
    paddingBottom: sharedTokens.spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: sharedTokens.spacing.sm
  },
  fullWidthButton: {
    width: '100%',
    alignSelf: 'stretch'
  },
  actionsRow: {
    flexDirection: 'row',
    gap: sharedTokens.spacing.smPlus,
    paddingHorizontal: sharedTokens.spacing.md,
    paddingTop: sharedTokens.spacing.smPlus,
    paddingBottom: sharedTokens.spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth
  },
  actionButton: {
    flex: 1
  }
})
