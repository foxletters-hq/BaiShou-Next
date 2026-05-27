import { StyleSheet } from 'react-native'

export const chatBubbleStyles = StyleSheet.create({
  container: {
    marginVertical: 8,
    flexDirection: 'row',
    paddingHorizontal: 16,
    alignItems: 'flex-start'
  },
  containerUser: {
    justifyContent: 'flex-end'
  },
  containerAssistant: {
    justifyContent: 'flex-start'
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginTop: 4
  },
  avatarText: {
    fontSize: 16
  },
  bubbleWrapper: {
    flex: 1,
    maxWidth: '85%'
  },
  bubble: {
    padding: 12,
    borderRadius: 16
  },
  text: {
    fontSize: 15,
    lineHeight: 22
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
    fontSize: 15,
    lineHeight: 22,
    minHeight: 44,
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
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6
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
    gap: 8,
    marginTop: 4
  },
  tokenText: {
    fontSize: 11,
    fontWeight: '500'
  },
  actionOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
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
