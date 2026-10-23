import { StyleSheet } from 'react-native'
import { mobileTypography, sharedTokens } from '@baishou/ui/theme/tokens'

/** 弹层、队列面板、设置区与原文预览样式 */
export const overlayStyles = StyleSheet.create({
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
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: sharedTokens.spacing.xsPlus
  },
  settingsHead: {
    paddingVertical: sharedTokens.spacing.sm
  },
  settingsBody: {
    gap: sharedTokens.spacing.sm,
    paddingBottom: sharedTokens.spacing.sm
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
