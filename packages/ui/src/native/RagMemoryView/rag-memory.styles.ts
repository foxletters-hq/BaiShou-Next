import { StyleSheet } from 'react-native'
import { sharedTokens, mobileTypography } from '../../theme/tokens'

export const ragMemoryStyles = StyleSheet.create({
  root: {},
  compactToolbar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center'
  },
  compactMeta: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: mobileTypography.secondary.fontWeight
  },
  disabledAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.sm,
    padding: sharedTokens.spacing.mdTight,
    borderRadius: sharedTokens.radius.md
  },
  disabledAlertText: {
    flex: 1,
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: mobileTypography.secondary.fontWeight,
    lineHeight: 18
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: sharedTokens.spacing.sm
  },
  statChip: {
    flexGrow: 1,
    flexBasis: '46%',
    minWidth: 132,
    borderRadius: sharedTokens.radius.md,
    paddingVertical: sharedTokens.spacing.smPlus,
    paddingHorizontal: sharedTokens.spacing.smPlus,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    gap: sharedTokens.spacing.xs
  },
  statValue: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: mobileTypography.secondary.fontWeight,
    textAlign: 'center'
  },
  statLabel: { fontSize: mobileTypography.caption.fontSize, textAlign: 'center' },
  alertBox: {
    marginTop: sharedTokens.spacing.mdTight,
    borderRadius: sharedTokens.radius.md,
    padding: sharedTokens.spacing.mdTight,
    borderWidth: 1
  },
  alertTitle: {
    fontSize: mobileTypography.primary.fontSize,
    fontWeight: '600',
    marginBottom: sharedTokens.spacing.xs
  },
  migrationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.sm,
    marginBottom: sharedTokens.spacing.xs
  },
  alertDesc: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: mobileTypography.secondary.fontWeight,
    lineHeight: 18
  },
  alertAction: {
    marginTop: sharedTokens.spacing.sm,
    paddingVertical: sharedTokens.spacing.sm,
    paddingHorizontal: sharedTokens.spacing.mdSnug,
    borderRadius: sharedTokens.radius.lgPlus,
    borderWidth: 1,
    alignSelf: 'flex-start'
  },
  batchEmbedActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: sharedTokens.spacing.sm,
    marginLeft: 'auto'
  },
  progressBox: {
    marginBottom: sharedTokens.spacing.mdTight
  },
  statusText: {
    fontSize: mobileTypography.primary.fontSize,
    fontWeight: '500',
    marginBottom: sharedTokens.spacing.sm
  },
  progressBar: {
    height: 6,
    borderRadius: sharedTokens.radius.xxs,
    overflow: 'hidden'
  },
  progressFill: {
    height: '100%',
    borderRadius: sharedTokens.radius.xxs
  },
  progressLabel: {
    fontSize: mobileTypography.caption.fontSize,
    fontWeight: mobileTypography.caption.fontWeight,
    marginTop: sharedTokens.spacing.xsPlus,
    textAlign: 'right'
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: sharedTokens.spacing.sm
  },
  entryCard: {
    borderWidth: 1,
    borderRadius: sharedTokens.radius.md,
    padding: sharedTokens.spacing.mdSnug,
    marginBottom: sharedTokens.spacing.sm,
    flexDirection: 'row',
    gap: sharedTokens.spacing.mdTight
  },
  entryIconBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: sharedTokens.spacing.xxs
  },
  entryBraces: {
    fontSize: mobileTypography.title.fontSize,
    fontWeight: mobileTypography.title.fontWeight
  },
  entryContent: {
    flex: 1
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: sharedTokens.spacing.sm,
    marginBottom: sharedTokens.spacing.xsPlus
  },
  entryKindBadge: {
    paddingHorizontal: sharedTokens.spacing.sm,
    paddingVertical: sharedTokens.spacing.xs,
    borderRadius: sharedTokens.radius.xs,
    overflow: 'hidden'
  },
  entryKindBadgeText: {
    fontSize: mobileTypography.caption.fontSize,
    fontWeight: mobileTypography.caption.fontWeight
  },
  entryMenuTrigger: {
    fontSize: mobileTypography.title.fontSize,
    fontWeight: mobileTypography.title.fontWeight
  },
  entryMenuLabel: {
    fontSize: mobileTypography.primary.fontSize,
    fontWeight: mobileTypography.primary.fontWeight
  },
  entryModel: {
    fontSize: mobileTypography.caption.fontSize,
    fontWeight: mobileTypography.caption.fontWeight,
    flex: 1
  },
  entryText: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: mobileTypography.secondary.fontWeight,
    lineHeight: 19,
    marginBottom: sharedTokens.spacing.xs
  },
  entryNodeLine: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: mobileTypography.secondary.fontWeight,
    lineHeight: 19,
    marginBottom: sharedTokens.spacing.xxs
  },
  entryViewLink: {
    fontSize: mobileTypography.caption.fontSize,
    marginBottom: sharedTokens.spacing.sm
  },
  entryPreviewScroll: { maxHeight: 360 },
  entryPreviewContent: { paddingRight: sharedTokens.spacing.mdTight },
  entryPreviewText: {
    fontSize: mobileTypography.primary.fontSize,
    fontWeight: mobileTypography.primary.fontWeight,
    lineHeight: 22
  },
  entryPreviewClose: {
    alignSelf: 'flex-end',
    paddingTop: sharedTokens.spacing.mdTight,
    paddingHorizontal: sharedTokens.spacing.xs
  },
  entryPreviewCloseLabel: {
    fontSize: mobileTypography.primary.fontSize,
    fontWeight: '600'
  },
  entryMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: sharedTokens.spacing.xsPlus,
    marginBottom: sharedTokens.spacing.xsPlus
  },
  entryTag: { fontSize: mobileTypography.caption.fontSize },
  entryFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: sharedTokens.spacing.sm
  },
  entryDate: { fontSize: mobileTypography.caption.fontSize },
  entrySimilarity: {
    fontSize: mobileTypography.caption.fontSize,
    fontWeight: mobileTypography.caption.fontWeight,
    paddingHorizontal: sharedTokens.spacing.xsPlus,
    paddingVertical: sharedTokens.spacing.xxs,
    borderRadius: sharedTokens.radius.xs
  },
  emptyBox: {
    paddingVertical: sharedTokens.spacing.lg,
    alignItems: 'center'
  },
  searchingBox: {
    paddingVertical: sharedTokens.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center'
  },
  menuOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1
  },
  entryMenu: {
    position: 'absolute',
    right: 0,
    top: 28,
    borderRadius: sharedTokens.radius.control,
    borderWidth: 1,
    paddingVertical: sharedTokens.spacing.xs,
    minWidth: 120,
    zIndex: 2
  },
  menuItem: {
    paddingVertical: sharedTokens.spacing.smPlus,
    paddingHorizontal: sharedTokens.spacing.mdSnug
  },
  paginationRow: {
    paddingTop: sharedTokens.spacing.mdTight,
    gap: sharedTokens.spacing.smPlus,
    borderTopWidth: StyleSheet.hairlineWidth
  },
  paginationMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: sharedTokens.spacing.sm
  },
  paginationInfo: {
    flex: 1,
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: mobileTypography.secondary.fontWeight
  },
  paginationNavScroll: {
    alignSelf: 'stretch'
  },
  paginationNavContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: sharedTokens.spacing.xxs
  },
  bottomSpacer: { height: 16 }
})
