import { StyleSheet } from 'react-native'
import { mobileTypography, sharedTokens } from '@baishou/ui/theme/tokens'

/** 力导向图画布工具栏、深度控件、物理参数与节点预览样式 */
export const canvasStyles = StyleSheet.create({
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
  }
})
