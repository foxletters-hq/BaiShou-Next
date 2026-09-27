import { StyleSheet } from 'react-native'

export const agentGateCardStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 16
  },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    zIndex: 2,
    maxHeight: '86%',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8
  },
  header: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 14,
    gap: 8
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8
  },
  queueNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  queueNavBtn: {
    width: 28,
    height: 28,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center'
  },
  queueLabel: {
    fontSize: 12
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
    flexShrink: 1
  },
  description: {
    fontSize: 14,
    lineHeight: 21
  },
  hint: {
    fontSize: 12,
    lineHeight: 18
  },
  previewBlock: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6
  },
  diffScroll: {
    maxHeight: 220
  },
  diffText: {
    fontFamily: 'monospace',
    fontSize: 11,
    lineHeight: 16
  },
  commandText: {
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 18
  },
  feedbackInput: {
    minHeight: 88,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: 'top'
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8
  },
  askFooter: {
    width: '100%',
    gap: 8
  },
  actionButton: {
    flexGrow: 1,
    flexBasis: 0,
    minWidth: 96
  }
})
