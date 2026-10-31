import { StyleSheet } from 'react-native'
import { mobileTypography, sharedTokens } from '../../theme/tokens'

export const mcpSettingsCardStyles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: sharedTokens.radius.md,
    overflow: 'hidden'
  },
  header: {
    paddingHorizontal: sharedTokens.spacing.mdSnug,
    paddingTop: sharedTokens.spacing.mdTight,
    paddingBottom: sharedTokens.spacing.sm
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.xsPlus
  },
  block: {
    gap: 0,
    paddingHorizontal: sharedTokens.spacing.mdSnug,
    paddingBottom: sharedTokens.spacing.xs
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: sharedTokens.spacing.smPlus,
    gap: sharedTokens.spacing.sm
  },
  rowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth
  },
  tokenBody: { flexDirection: 'column', alignItems: 'flex-start' },
  label: {
    fontSize: mobileTypography.secondary.fontSize
  },
  sub: {
    fontSize: mobileTypography.secondary.fontSize,
    lineHeight: 18
  },
  portRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: sharedTokens.spacing.smPlus,
    gap: sharedTokens.spacing.mdTight
  },
  portInput: {
    width: 100,
    fontSize: mobileTypography.secondary.fontSize,
    textAlign: 'center'
  },
  mono: {
    fontSize: mobileTypography.secondary.fontSize,
    fontFamily: 'monospace',
    marginTop: sharedTokens.spacing.xs
  },
  workspaceList: {
    width: '100%',
    gap: sharedTokens.spacing.sm,
    marginTop: sharedTokens.spacing.xsPlus
  },
  workspaceItem: {
    width: '100%',
    paddingHorizontal: sharedTokens.spacing.mdTight,
    paddingVertical: sharedTokens.spacing.smPlus,
    borderRadius: sharedTokens.radius.sm,
    gap: sharedTokens.spacing.xs
  },
  workspaceItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: sharedTokens.spacing.sm
  },
  workspaceTitleGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.xsPlus
  },
  workspaceName: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: mobileTypography.secondary.fontWeight
  },
  workspacePaginationRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: sharedTokens.spacing.sm,
    marginTop: sharedTokens.spacing.sm
  },
  workspacePageInfo: {
    fontSize: mobileTypography.caption.fontSize
  },
  workspaceActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.xsPlus
  },
  workspaceActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.xs,
    paddingHorizontal: sharedTokens.spacing.sm,
    paddingVertical: sharedTokens.spacing.xs,
    borderRadius: sharedTokens.radius.xsPlus,
    borderWidth: StyleSheet.hairlineWidth
  },
  workspaceActionBtnText: {
    fontSize: mobileTypography.caption.fontSize,
    fontWeight: mobileTypography.caption.fontWeight
  },
  copyBtn: {
    marginTop: sharedTokens.spacing.sm,
    paddingHorizontal: sharedTokens.spacing.mdTight,
    paddingVertical: sharedTokens.spacing.sm,
    borderRadius: sharedTokens.radius.sm
  },
  tokenActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.sm,
    marginTop: sharedTokens.spacing.sm
  },
  iconBtn: {
    padding: sharedTokens.spacing.sm,
    borderRadius: sharedTokens.radius.sm
  },
  panel: {
    position: 'relative'
  },
  panelDimmed: {
    opacity: 0.45
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sharedTokens.spacing.sm,
    zIndex: 1
  },
  loadingText: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '500'
  },
  helpIntro: {
    fontSize: mobileTypography.secondary.fontSize,
    lineHeight: 20
  },
  helpHeading: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '600'
  },
  helpSubTitle: {
    fontSize: mobileTypography.caption.fontSize,
    fontWeight: '600',
    marginTop: sharedTokens.spacing.xsPlus
  },
  helpCodeBlock: {
    fontSize: mobileTypography.caption.fontSize,
    fontFamily: 'monospace',
    padding: sharedTokens.spacing.sm,
    borderRadius: sharedTokens.radius.xsPlus,
    lineHeight: 15
  },
  helpNote: {
    fontSize: mobileTypography.caption.fontSize,
    fontStyle: 'italic',
    marginTop: sharedTokens.spacing.xs
  }
})
