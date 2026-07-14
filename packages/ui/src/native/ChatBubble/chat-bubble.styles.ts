import { StyleSheet, type DimensionValue } from 'react-native'

/**
 * 聊天气泡正文现已全程 LegacyMarkdown（测高稳定）。
 * markdownSlotStreaming 仅作历史兼容保留，流式不必再垫底。
 */
export const CHAT_MARKDOWN_BOTTOM_GUARD = 12

/** 同行头像列（32 头像 + 8 间距）及对侧留白；RN StyleSheet 不支持 calc() */
const CHAT_BUBBLE_MAX_WIDTH = '88%' as DimensionValue
const CHAT_BUBBLE_OPPOSITE_GAP = 36

const chatBubbleLayoutStyles = StyleSheet.create({
  container: {
    marginVertical: 8,
    flexDirection: 'row',
    paddingHorizontal: 12,
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
    gap: 8,
    paddingBottom: 6,
    width: '100%'
  },
  nameTimeRowUser: {
    justifyContent: 'flex-end',
    paddingRight: 4
  },
  nameTimeRowAssistant: {
    justifyContent: 'flex-start',
    paddingLeft: 4
  },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
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
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 6
  },
  editBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent'
  },
  comfortableEditBtn: {
    minHeight: 32,
    paddingHorizontal: 14,
    paddingVertical: 7
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
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
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12
  },
  deferredChromeSpacer: {
    height: 36,
    width: '100%'
  },
  tokenRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 8,
    width: '100%',
    flexBasis: '100%'
  },
  actionOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end'
  },
  actionSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    paddingBottom: 32,
    maxHeight: '60%'
  },
  actionItem: {
    paddingHorizontal: 24,
    paddingVertical: 14
  },
  actionCancel: {
    marginTop: 8,
    paddingTop: 14,
    borderTopWidth: 1,
    alignItems: 'center'
  }
})

const chatBubbleTextStyles = StyleSheet.create({
  nameLabel: {
    fontSize: 12,
    fontWeight: '600',
    flexShrink: 0
  },
  timeLabel: {
    fontSize: 10
  },
  nameLabelUser: {
    textAlign: 'right'
  },
  nameLabelAssistant: {
    textAlign: 'left'
  },
  bubbleNameLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    alignSelf: 'stretch'
  },
  text: {
    fontSize: 15,
    lineHeight: 24,
    textAlign: 'left',
    flexShrink: 1
  },
  reasoningLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4
  },
  reasoningText: {
    fontSize: 13,
    lineHeight: 18,
    fontStyle: 'italic'
  },
  editInput: {
    width: '100%',
    fontSize: 15,
    lineHeight: 22,
    minHeight: 72,
    maxHeight: 260,
    padding: 0
  },
  editBtnText: {
    fontSize: 13,
    fontWeight: '600'
  },
  comfortableEditBtnText: {
    fontSize: 13
  },
  actionChipText: {
    fontSize: 12,
    fontWeight: '500'
  },
  tokenText: {
    fontSize: 11,
    fontWeight: '500'
  },
  actionSheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
    paddingHorizontal: 16
  },
  actionItemText: {
    fontSize: 16
  },
  actionCancelText: {
    fontSize: 16,
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
