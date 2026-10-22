import { StyleSheet } from 'react-native'
import { mobileTypography, sharedTokens } from '@baishou/ui/theme/tokens'

/** 页面骨架、待确认列表、搜索与卡片等列表区域样式 */
export const listStyles = StyleSheet.create({
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
  fullRowButtonWrap: {
    width: '100%',
    marginBottom: sharedTokens.spacing.md
  },
  fullRowButton: {
    alignSelf: 'stretch',
    width: '100%'
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
    paddingVertical: sharedTokens.spacing.mdTight,
    paddingHorizontal: sharedTokens.spacing.mdSnug,
    borderRadius: sharedTokens.radius.md,
    marginBottom: sharedTokens.spacing.md,
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
  }
})
