import { StyleSheet } from 'react-native'

export const diaryScreenStyles = StyleSheet.create({
  safeArea: {
    flex: 1
  },
  container: {
    flex: 1,
    position: 'relative'
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 14,
    minHeight: 32,
    paddingHorizontal: 20,
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth
  },
  statusItem: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500'
  },
  deleteOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24
  },
  deleteModal: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 16,
    padding: 24
  },
  deleteTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12
  },
  deleteContent: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24
  },
  deleteActions: {
    flexDirection: 'row',
    gap: 12
  },
  deleteCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center'
  },
  deleteConfirm: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center'
  }
})
