import { StyleSheet } from 'react-native'

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
    marginLeft: 24
  },
  bubbleWrapperAssistant: {
    alignItems: 'flex-start',
    marginRight: 24,
    flex: 1,
    width: '100%'
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
    marginBottom: 4
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
    width: '100%'
  },
  text: {
    fontSize: 15,
    lineHeight: 24
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
    minHeight: 100,
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
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
    width: '100%'
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
