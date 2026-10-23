import { StyleSheet, type DimensionValue } from 'react-native'
import { mobileTypography, sharedTokens } from '../../theme/tokens'

/**
 * 聊天气泡正文现已全程 LegacyMarkdown（测高稳定）。
 * markdownSlotStreaming 仅作历史兼容保留，流式不必再垫底。
 */
export const CHAT_MARKDOWN_BOTTOM_GUARD = 12

/** 同行头像列（32 头像 + 8 间距）及对侧留白，用户/伙伴共用；RN StyleSheet 不支持 calc() */
const CHAT_BUBBLE_MAX_WIDTH = '88%' as DimensionValue
const CHAT_BUBBLE_OPPOSITE_GAP = 36

const chatBubbleLayoutStyles = StyleSheet.create({
  container: {
    marginVertical: sharedTokens.spacing.sm,
    flexDirection: 'row',
    paddingHorizontal: sharedTokens.spacing.mdTight,
    paddingVertical: 0,
    alignItems: 'flex-start',
    width: '100%'
  },
  containerUser: {
    justifyContent: 'flex-end'
  },
  containerAssistant: {
    justifyContent: 'flex-start'
  },
  bubbleWrapper: {
    flexShrink: 1,
    maxWidth: CHAT_BUBBLE_MAX_WIDTH,
    minWidth: 0
  },
  bubbleWrapperUser: {
    alignItems: 'flex-end',
    alignSelf: 'flex-end',
    marginLeft: CHAT_BUBBLE_OPPOSITE_GAP,
    maxWidth: CHAT_BUBBLE_MAX_WIDTH,
    minWidth: 0,
    flexShrink: 1
  },
  bubbleWrapperAssistant: {
    flexShrink: 1,
    alignItems: 'flex-start',
    alignSelf: 'flex-start',
    marginRight: CHAT_BUBBLE_OPPOSITE_GAP,
    maxWidth: CHAT_BUBBLE_MAX_WIDTH,
    minWidth: 0
  },
  bubbleWrapperEditing: {
    width: CHAT_BUBBLE_MAX_WIDTH,
    maxWidth: CHAT_BUBBLE_MAX_WIDTH
  },
  bubbleEditing: {
    width: '100%',
    alignSelf: 'stretch'
  },
  editInputWrap: {
    width: '100%',
    alignSelf: 'stretch'
  },
  nameTimeRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: sharedTokens.spacing.sm,
    paddingBottom: sharedTokens.spacing.xsPlus,
    width: '100%'
  },
  nameTimeRowUser: {
    justifyContent: 'flex-end',
    paddingRight: sharedTokens.spacing.xs
  },
  nameTimeRowAssistant: {
    justifyContent: 'flex-start',
    paddingLeft: sharedTokens.spacing.xs
  },
  bubble: {
    paddingHorizontal: sharedTokens.spacing.mdSnug,
    paddingVertical: sharedTokens.spacing.smPlus,
    borderRadius: sharedTokens.radius.lg,
    alignSelf: 'stretch',
    width: '100%',
    overflow: 'visible'
  },
  bubblePressable: {
    alignSelf: 'stretch',
    width: '100%'
  },
  markdownSlot: {
    alignSelf: 'stretch',
    width: '100%'
  },
  /** 流式 EnrichedMarkdown 少报高度时的底部缓冲（完成态勿用） */
  markdownSlotStreaming: {
    alignSelf: 'stretch',
    width: '100%',
    paddingBottom: CHAT_MARKDOWN_BOTTOM_GUARD
  },
  plainTextSlot: {
    alignSelf: 'stretch',
    width: '100%'
  },
  bubbleUser: {
    alignSelf: 'flex-end',
    width: undefined,
    maxWidth: '100%',
    minWidth: 0
  },
  reasoningBlock: {
    marginBottom: sharedTokens.spacing.sm,
    paddingBottom: sharedTokens.spacing.sm,
    borderBottomWidth: 1
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: sharedTokens.spacing.sm,
    marginTop: sharedTokens.spacing.xsPlus
  },
  editBtn: {
    paddingHorizontal: sharedTokens.spacing.mdTight,
    paddingVertical: sharedTokens.spacing.xsPlus,
    borderRadius: sharedTokens.radius.sm,
    borderWidth: 1,
    borderColor: 'transparent'
  },
  comfortableEditBtn: {
    minHeight: 32,
    paddingHorizontal: sharedTokens.spacing.mdSnug,
    paddingVertical: sharedTokens.spacing.sm
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    flexWrap: 'wrap',
    gap: sharedTokens.spacing.sm,
    marginTop: sharedTokens.spacing.xs,
    width: '100%',
    alignSelf: 'stretch',
    minHeight: 26
  },
  actionsRowUser: {
    alignSelf: 'flex-end',
    width: undefined,
    maxWidth: '100%',
    justifyContent: 'flex-end',
    minHeight: 26
  },
  actionChip: {
    paddingHorizontal: sharedTokens.spacing.sm,
    paddingVertical: sharedTokens.spacing.xs,
    borderRadius: sharedTokens.radius.md
  },
  deferredChromeSpacer: {
    height: 36,
    width: '100%'
  },
  deferredChromeHidden: {
    opacity: 0
  },
  tokenRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: sharedTokens.spacing.sm,
    width: '100%',
    flexBasis: '100%'
  },
  actionOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end'
  },
  actionSheet: {
    borderTopLeftRadius: sharedTokens.radius.lgPlus,
    borderTopRightRadius: sharedTokens.radius.lgPlus,
    paddingTop: sharedTokens.spacing.md,
    paddingBottom: sharedTokens.spacing.xl,
    maxHeight: '60%'
  },
  actionItem: {
    paddingHorizontal: sharedTokens.spacing.lg,
    paddingVertical: sharedTokens.spacing.mdSnug
  },
  actionCancel: {
    marginTop: sharedTokens.spacing.sm,
    paddingTop: sharedTokens.spacing.mdSnug,
    borderTopWidth: 1,
    alignItems: 'center'
  }
})

const chatBubbleTextStyles = StyleSheet.create({
  nameLabel: {
    fontSize: mobileTypography.caption.fontSize,
    fontWeight: '600',
    flexShrink: 0
  },
  timeLabel: {
    fontSize: mobileTypography.caption.fontSize
  },
  nameLabelUser: {
    textAlign: 'right'
  },
  nameLabelAssistant: {
    textAlign: 'left'
  },
  bubbleNameLabel: {
    fontSize: mobileTypography.caption.fontSize,
    fontWeight: '600',
    marginBottom: sharedTokens.spacing.xsPlus,
    alignSelf: 'stretch'
  },
  text: {
    fontSize: mobileTypography.body.fontSize,
    lineHeight: 24,
    textAlign: 'left',
    flexShrink: 1
  },
  reasoningLabel: {
    fontSize: mobileTypography.caption.fontSize,
    fontWeight: '600',
    marginBottom: sharedTokens.spacing.xs
  },
  reasoningText: {
    fontSize: mobileTypography.secondary.fontSize,
    lineHeight: 18,
    fontStyle: 'italic'
  },
  editInput: {
    width: '100%',
    fontSize: mobileTypography.body.fontSize,
    lineHeight: 22,
    minHeight: 72,
    maxHeight: 260,
    padding: 0
  },
  editBtnText: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '600'
  },
  comfortableEditBtnText: {
    fontSize: mobileTypography.secondary.fontSize
  },
  actionChipText: {
    fontSize: mobileTypography.caption.fontSize,
    fontWeight: '500'
  },
  tokenText: {
    fontSize: mobileTypography.caption.fontSize,
    fontWeight: '500'
  },
  actionSheetTitle: {
    fontSize: mobileTypography.primary.fontSize,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: sharedTokens.spacing.mdTight,
    paddingHorizontal: sharedTokens.spacing.md
  },
  actionItemText: {
    fontSize: mobileTypography.primary.fontSize
  },
  actionCancelText: {
    fontSize: mobileTypography.primary.fontSize,
    fontWeight: '600'
  }
})

type ChatBubbleStyles = {
  [K in
    | keyof typeof chatBubbleLayoutStyles
    | keyof typeof chatBubbleTextStyles]: K extends keyof typeof chatBubbleLayoutStyles
    ? (typeof chatBubbleLayoutStyles)[K]
    : K extends keyof typeof chatBubbleTextStyles
      ? (typeof chatBubbleTextStyles)[K]
      : never
}

export const chatBubbleStyles = {
  ...chatBubbleLayoutStyles,
  ...chatBubbleTextStyles
} as ChatBubbleStyles
