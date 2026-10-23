import { StyleSheet } from 'react-native'
import { mobileTypography, sharedTokens } from '@baishou/ui/theme/tokens'

/** 详情面板、相关关系与添加关系弹层的局部样式 */
export const detailStyles = StyleSheet.create({
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
  }
})
