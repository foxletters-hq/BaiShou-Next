import { StyleSheet } from 'react-native'
import { mobileTypography, sharedTokens } from '@baishou/ui/theme/tokens'

export const styles = StyleSheet.create({
  layoutContent: {
    flex: 1,
    position: 'relative'
  },
  bootShell: {
    flex: 1
  },
  status: {
    paddingHorizontal: sharedTokens.spacing.md,
    marginBottom: sharedTokens.spacing.sm,
    fontSize: mobileTypography.secondary.fontSize
  },
  graphBody: {
    flex: 1
  },
  pendingPane: {
    flex: 1
  },
  pendingList: {
    flex: 1
  },
  pendingToolbar: {
    paddingHorizontal: sharedTokens.spacing.md,
    paddingTop: sharedTokens.spacing.md,
    paddingBottom: sharedTokens.spacing.sm,
    gap: sharedTokens.spacing.sm
  },
  pendingHintBox: {
    borderWidth: 1,
    borderRadius: sharedTokens.radius.sm,
    padding: sharedTokens.spacing.smPlus,
    gap: sharedTokens.spacing.xs
  },
  pendingHintText: {
    fontSize: mobileTypography.secondary.fontSize,
    lineHeight: 18
  },
  pendingToolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: sharedTokens.spacing.sm
  },
  pendingSelectAllGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.smPlus,
    flexShrink: 1
  },
  pendingSelectAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.smPlus,
    paddingVertical: sharedTokens.spacing.xs
  },
  pendingCheck: {
    marginTop: sharedTokens.spacing.xxs
  },
  pendingTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: sharedTokens.spacing.smPlus
  },
  pendingActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: sharedTokens.spacing.md,
    marginTop: sharedTokens.spacing.smPlus
  },
  pendingToolbarActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: sharedTokens.spacing.mdTight
  },
  webWrap: {
    flex: 1,
    position: 'relative'
  },
  toolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.sm,
    paddingHorizontal: sharedTokens.spacing.mdTight,
    paddingVertical: sharedTokens.spacing.xsPlus
  },
  toolBtn: {
    paddingHorizontal: sharedTokens.spacing.smPlus,
    paddingVertical: sharedTokens.spacing.sm,
    borderRadius: sharedTokens.radius.control,
    borderWidth: StyleSheet.hairlineWidth
  },
  depthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.xsPlus,
    paddingHorizontal: sharedTokens.spacing.mdTight,
    paddingBottom: sharedTokens.spacing.xsPlus
  },
  depthLabel: {
    fontSize: mobileTypography.caption.fontSize,
    marginRight: sharedTokens.spacing.xxs
  },
  depthChip: {
    paddingHorizontal: sharedTokens.spacing.smPlus,
    paddingVertical: sharedTokens.spacing.xs,
    borderRadius: sharedTokens.radius.sm,
    borderWidth: StyleSheet.hairlineWidth
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: sharedTokens.spacing.xsPlus
  },
  forceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.sm
  },
  forceLabel: {
    width: 44,
    fontSize: mobileTypography.caption.fontSize
  },
  forceLabelWide: {
    width: 72,
    fontSize: mobileTypography.caption.fontSize
  },
  forceValue: {
    width: 36,
    fontSize: mobileTypography.caption.fontSize,
    textAlign: 'right'
  },
  detailPanel: {
    maxHeight: 280,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  detailPanelContent: {
    paddingHorizontal: sharedTokens.spacing.md,
    paddingVertical: sharedTokens.spacing.smPlus,
    gap: sharedTokens.spacing.xsPlus
  },
  renameInput: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '600',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: sharedTokens.radius.sm,
    paddingHorizontal: sharedTokens.spacing.smPlus,
    paddingVertical: sharedTokens.spacing.xsPlus
  },
  multilineInput: {
    minHeight: 56,
    fontWeight: '400',
    textAlignVertical: 'top'
  },
  detailSummaryInput: {
    minHeight: sharedTokens.spacing.xxxl * 2
  },
  detailMeta: {
    fontSize: mobileTypography.caption.fontSize
  },
  nodeReviewBanner: {
    borderWidth: 1,
    borderRadius: sharedTokens.radius.md,
    padding: sharedTokens.spacing.smPlus,
    gap: sharedTokens.spacing.xsPlus
  },
  incidentBlock: {
    gap: sharedTokens.spacing.xsPlus,
    marginTop: sharedTokens.spacing.xs
  },
  detailActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: sharedTokens.spacing.sm
  },
  incidentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: sharedTokens.spacing.smPlus,
    paddingVertical: sharedTokens.spacing.sm,
    paddingHorizontal: sharedTokens.spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: sharedTokens.radius.sm
  },
  incidentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: sharedTokens.spacing.sm
  },
  guide: {
    padding: sharedTokens.spacing.lg,
    gap: sharedTokens.spacing.mdTight
  },
  guideTitle: {
    fontSize: mobileTypography.primary.fontSize,
    fontWeight: '600'
  },
  guideBody: {
    fontSize: mobileTypography.secondary.fontSize,
    lineHeight: 22
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.mdTight,
    paddingHorizontal: sharedTokens.spacing.md,
    marginBottom: sharedTokens.spacing.sm
  },
  searchModeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.sm,
    paddingHorizontal: sharedTokens.spacing.md,
    marginBottom: sharedTokens.spacing.smPlus
  },
  card: {
    paddingVertical: sharedTokens.spacing.smPlus,
    paddingHorizontal: sharedTokens.spacing.mdSnug,
    borderRadius: sharedTokens.radius.md,
    marginBottom: sharedTokens.spacing.smPlus,
    borderWidth: 1
  },
  similarNodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.xs,
    marginBottom: sharedTokens.spacing.xs
  },
  similarNodeLabel: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '500'
  },
  similarNodePressable: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1
  },
  similarNodeName: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '600'
  },
  cardTitle: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '600'
  },
  cardMeta: {
    fontSize: mobileTypography.caption.fontSize,
    marginTop: sharedTokens.spacing.xs,
    lineHeight: 18
  },
  row: {
    flexDirection: 'row',
    gap: sharedTokens.spacing.md,
    marginTop: sharedTokens.spacing.smPlus,
    flexWrap: 'wrap'
  },
  queueModalPad: {
    padding: sharedTokens.spacing.md
  },
  queueModalSubtitle: {
    fontSize: mobileTypography.secondary.fontSize,
    lineHeight: 18,
    marginTop: sharedTokens.spacing.xs
  },
  concurrencyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: sharedTokens.spacing.xsPlus,
    marginTop: sharedTokens.spacing.smPlus
  },
  concurrencyChip: {
    minWidth: 28,
    height: 28,
    paddingHorizontal: sharedTokens.spacing.sm,
    borderRadius: sharedTokens.radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  queueModalList: {
    maxHeight: 280,
    marginTop: sharedTokens.spacing.sm
  },
  queueOverallRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: sharedTokens.spacing.mdTight,
    marginTop: sharedTokens.spacing.mdTight
  },
  queueOverallPct: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '600'
  },
  queueModalItem: {
    paddingVertical: sharedTokens.spacing.smPlus,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(127,127,127,0.2)'
  },
  queueModalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: sharedTokens.spacing.mdSnug
  },
  queueDockItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.sm
  },
  queueDockName: {
    flex: 1,
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '500'
  },
  queueProgress: {
    marginTop: sharedTokens.spacing.xsPlus,
    height: 3,
    borderRadius: sharedTokens.radius.full,
    overflow: 'hidden'
  },
  queueProgressBar: {
    height: '100%',
    borderRadius: sharedTokens.radius.full
  },
  addEdgeSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.smPlus
  },
  addEdgeSearchToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.sm
  },
  addEdgeSearchBox: {
    flex: 1,
    minWidth: 120,
    height: 34,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    borderRadius: sharedTokens.radius.sm,
    borderWidth: 1,
    paddingHorizontal: sharedTokens.spacing.smPlus
  },
  addEdgeSearchInputWrap: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.xsPlus,
    backgroundColor: 'transparent',
    borderWidth: 0,
    padding: 0,
    margin: 0
  },
  addEdgeSearchInput: {
    flex: 1,
    minWidth: 0,
    height: 32,
    minHeight: 0,
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '400',
    paddingVertical: 0,
    backgroundColor: 'transparent',
    includeFontPadding: false,
    textAlignVertical: 'center'
  },
  edgeTypeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: sharedTokens.spacing.sm,
    justifyContent: 'space-between'
  },
  edgeTypeChip: {
    paddingHorizontal: sharedTokens.spacing.sm,
    paddingVertical: sharedTokens.spacing.xs,
    borderRadius: sharedTokens.radius.sm,
    borderWidth: StyleSheet.hairlineWidth
  },
  addEdgeTypeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: sharedTokens.spacing.sm,
    justifyContent: 'space-between'
  },
  addEdgeTypeChip: {
    flexBasis: '30%',
    flexGrow: 1,
    minWidth: 80,
    height: 38,
    paddingVertical: sharedTokens.spacing.xsPlus,
    paddingHorizontal: sharedTokens.spacing.sm,
    borderRadius: sharedTokens.radius.control,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  addEdgeTypeChipText: {
    fontSize: mobileTypography.secondary.fontSize,
    textAlign: 'center'
  },
  hitBtn: {
    paddingVertical: sharedTokens.spacing.sm,
    paddingHorizontal: sharedTokens.spacing.smPlus,
    borderRadius: sharedTokens.radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    gap: sharedTokens.spacing.xxs
  },
  modalPad: {
    padding: sharedTokens.spacing.md,
    gap: sharedTokens.spacing.smPlus
  },
  modalTitle: {
    fontSize: mobileTypography.title.fontSize,
    fontWeight: mobileTypography.title.fontWeight,
    marginBottom: sharedTokens.spacing.xs
  },
  filterSectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: sharedTokens.spacing.xs
  },
  typeChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: sharedTokens.spacing.xsPlus
  },
  settingsHead: {
    paddingVertical: sharedTokens.spacing.sm
  },
  settingsBody: {
    gap: sharedTokens.spacing.sm,
    paddingBottom: sharedTokens.spacing.sm
  },
  opsLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.xsPlus
  },
  opsBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: sharedTokens.spacing.sm,
    paddingHorizontal: sharedTokens.spacing.mdTight,
    paddingTop: sharedTokens.spacing.smPlus
  },
  opsBtnRow: {
    flexDirection: 'row',
    gap: sharedTokens.spacing.sm
  },
  canvasSettingsFab: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 40,
    height: 40,
    borderRadius: sharedTokens.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center'
  },
  peekCard: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.mdTight,
    paddingHorizontal: sharedTokens.spacing.mdTight,
    paddingVertical: sharedTokens.spacing.smPlus,
    borderRadius: sharedTokens.radius.md,
    borderWidth: StyleSheet.hairlineWidth
  },
  peekName: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '600'
  },
  opsPrimaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: sharedTokens.spacing.smPlus,
    borderRadius: sharedTokens.radius.control
  },
  sourceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: sharedTokens.spacing.mdTight,
    paddingHorizontal: sharedTokens.spacing.md,
    paddingTop: sharedTokens.spacing.mdSnug,
    paddingBottom: sharedTokens.spacing.smPlus
  },
  sourceTitle: {
    flex: 1,
    fontSize: mobileTypography.primary.fontSize,
    fontWeight: '600'
  },
  sourceLoading: {
    paddingVertical: sharedTokens.spacing.xlPlus,
    alignItems: 'center',
    justifyContent: 'center'
  },
  sourceScroll: {
    maxHeight: 420
  },
  sourceScrollContent: {
    paddingHorizontal: sharedTokens.spacing.md,
    paddingBottom: sharedTokens.spacing.mdPlus
  }
})
