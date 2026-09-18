import { StyleSheet } from 'react-native'

export const diaryEditorStyles = StyleSheet.create({
  container: { flex: 1 },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1
  },
  iconBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  appBarCenter: { flex: 1, alignItems: 'center', minWidth: 0 },
  saveBtn: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20 },
  saveBtnText: { fontWeight: '600', fontSize: 14 },
  metaBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1
  },
  metaPickers: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    flexWrap: 'wrap'
  },
  favBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  ttsBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  editorBody: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden'
  },
  editorPane: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8
  },
  editorFill: {
    flex: 1
  },
  toolbarDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 10,
    elevation: 10
  },
  editorLoadFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 48
  },
  editorLoadHint: {
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 24
  }
})
