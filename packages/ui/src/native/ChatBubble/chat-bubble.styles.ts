import { StyleSheet } from 'react-native'

/**
 * EnrichedMarkdownText 末行常少报高度；Legacy 渲染器走 RN Text 布局无此问题。
 * 流式 EnrichedMarkdown 仍保留一行缓冲。
 */
export const CHAT_MARKDOWN_BOTTOM_GUARD = 24

export const chatBubbleStyles = StyleSheet.create({
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
    maxWidth: '88%',
    minWidth: 0
  },
  bubbleWrapperUser: {
    alignItems: 'flex-end',
    alignSelf: 'flex-end',
    marginLeft: 24,
    maxWidth: '88%'
  },
  bubbleWrapperAssistant: {
    flexShrink: 1,
    alignItems: 'flex-start',
    alignSelf: 'flex-start',
    marginRight: 24,
    maxWidth: '88%',
    minWidth: 0
  },
  bubbleWrapperEditing: {
    width: '88%',
    maxWidth: '88%'
  },
  bubbleEditing: {
    width: '100%',
    alignSelf: 'stretch'
  },
  editInputWrap: {
    width: '100%',
    alignSelf: 'stretch'
  },
  nameLabel: {
    fontSize: 12,
    fontWeight: '600',
    flexShrink: 0
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
  bubbleNameLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    alignSelf: 'stretch'
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
    maxWidth: '100%'
  },
  text: {
    fontSize: 15,
    lineHeight: 24,
    textAlign: 'right'
  },
  reasoningBlock: {
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1
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
  editBtnText: {
    fontSize: 13,
    fontWeight: '600'
  },
  comfortableEditBtn: {
    minHeight: 32,
    paddingHorizontal: 14,
    paddingVertical: 7
  },
  comfortableEditBtnText: {
    fontSize: 13
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
  actionChipText: {
    fontSize: 12,
    fontWeight: '500'
  },
  /** 流式期间占位，高度对齐操作栏 + token 行，避免显示 chrome 时突增 */
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
  tokenText: {
    fontSize: 11,
    fontWeight: '500'
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
  actionSheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
    paddingHorizontal: 16
  },
  actionItem: {
    paddingHorizontal: 24,
    paddingVertical: 14
  },
  actionItemText: {
    fontSize: 16
  },
  actionCancel: {
    marginTop: 8,
    paddingTop: 14,
    borderTopWidth: 1,
    alignItems: 'center'
  },
  actionCancelText: {
    fontSize: 16,
    fontWeight: '600'
  }
})
