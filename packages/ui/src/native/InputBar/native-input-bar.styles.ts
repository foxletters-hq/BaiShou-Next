import { Platform, StyleSheet } from 'react-native'
import { INPUT_CARD_BOTTOM_ROW, INPUT_MIN_HEIGHT } from './input-bar-height.util'
import { iconSizes, mobileTypography, settingsIcons, sharedTokens } from '../../theme/tokens'

export const nativeInputBarStyles = StyleSheet.create({
  container: {
    // 分割线与底栏背景放在 composerChrome，避免快捷面板撑开时整条顶边被抬起
  },
  composerBlock: {
    position: 'relative',
    overflow: 'visible',
    zIndex: 20
  },
  composerChromeAnchor: {
    position: 'relative',
    zIndex: 1
  },
  composerChrome: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: sharedTokens.spacing.sm,
    paddingHorizontal: sharedTokens.spacing.mdSnug,
    paddingBottom: sharedTokens.spacing.smPlus
  },
  composerShell: {
    borderWidth: 1,
    borderRadius: sharedTokens.radius.lg,
    overflow: 'hidden'
  },
  toolbarAttached: {
    paddingTop: sharedTokens.spacing.xsPlus,
    paddingBottom: sharedTokens.spacing.xs
  },
  toolbarContent: {
    gap: sharedTokens.spacing.sm,
    paddingHorizontal: sharedTokens.spacing.xs,
    alignItems: 'center'
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.xs,
    paddingHorizontal: sharedTokens.spacing.mdTight,
    paddingVertical: sharedTokens.spacing.sm,
    borderRadius: sharedTokens.radius.lg,
    borderWidth: 1
  },
  chipIcon: {
    fontSize: mobileTypography.secondary.fontSize
  },
  chipLabel: {
    fontSize: mobileTypography.caption.fontSize,
    fontWeight: '500',
    maxWidth: 120
  },
  toolbarToggle: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center'
  },
  inputCard: {
    borderWidth: 0,
    borderRadius: 0,
    paddingTop: sharedTokens.spacing.xsPlus,
    paddingHorizontal: sharedTokens.spacing.smPlus,
    paddingBottom: sharedTokens.spacing.xsPlus
  },
  skillCiteRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: sharedTokens.spacing.sm,
    marginBottom: sharedTokens.spacing.xs
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start'
  },
  topRowSingleLine: {
    alignItems: 'center'
  },
  inputWrapper: {
    flex: 1,
    minWidth: 0
  },
  expandToggle: {
    width: 28,
    height: 28,
    marginLeft: sharedTokens.spacing.xxs,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  expandToggleMultiline: {
    marginTop: sharedTokens.spacing.xs
  },
  input: {
    minHeight: INPUT_MIN_HEIGHT,
    fontSize: mobileTypography.body.fontSize,
    lineHeight: 20,
    paddingLeft: sharedTokens.spacing.xs,
    paddingRight: sharedTokens.spacing.xs,
    paddingTop: Platform.OS === 'ios' ? 8 : 6,
    paddingBottom: Platform.OS === 'ios' ? 8 : 6,
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null)
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 0,
    height: INPUT_CARD_BOTTOM_ROW,
    flexShrink: 0
  },
  bottomActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.xsPlus
  },
  sendBtn: {
    width: 32,
    height: 32,
    borderRadius: sharedTokens.radius.lg,
    alignItems: 'center',
    justifyContent: 'center'
  },
  sendIcon: {
    fontSize: settingsIcons.trailing,
    fontWeight: '600'
  },
  stopBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center'
  },
  stopIcon: {
    width: 8,
    height: 8,
    borderRadius: sharedTokens.radius.xxs
  },
  attachmentList: {
    flexDirection: 'row',
    marginBottom: sharedTokens.spacing.smPlus,
    maxHeight: 64
  },
  attachmentChip: {
    marginRight: sharedTokens.spacing.sm,
    borderRadius: sharedTokens.radius.sm,
    borderWidth: 1,
    width: 64,
    height: 64,
    overflow: 'hidden',
    position: 'relative'
  },
  attImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover'
  },
  attDoc: {
    flex: 1,
    padding: sharedTokens.spacing.xs,
    alignItems: 'center',
    justifyContent: 'center'
  },
  attDocIcon: {
    fontSize: iconSizes.md,
    marginBottom: sharedTokens.spacing.xxs
  },
  attDocName: {
    fontSize: mobileTypography.caption.fontSize,
    textAlign: 'center'
  },
  attRemoveBtn: {
    position: 'absolute',
    top: 2,
    right: 2,
    borderRadius: sharedTokens.radius.sm,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center'
  },
  attRemoveLabel: {
    fontSize: mobileTypography.caption.fontSize,
    fontWeight: '600'
  }
})
