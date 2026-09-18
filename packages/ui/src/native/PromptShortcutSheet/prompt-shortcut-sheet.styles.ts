import { StyleSheet } from 'react-native'

export const promptShortcutSheetStyles = StyleSheet.create({
  gestureRoot: {
    flex: 1
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  safeArea: {
    width: '100%',
    alignItems: 'center',
    zIndex: 2
  },
  modalContent: {
    overflow: 'hidden'
  },
  listPane: {
    flex: 1
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  headerText: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1
  },
  closeIcon: {
    fontSize: 24,
    lineHeight: 24
  },
  addBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    paddingHorizontal: 12,
    marginBottom: 8,
    gap: 8,
    borderRadius: 10,
    borderWidth: 1
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
    height: 40
  },
  slashHint: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth
  },
  dragHint: {
    fontSize: 11,
    marginBottom: 8
  },
  listArea: {
    flex: 1,
    minHeight: 160
  },
  list: {
    flex: 1
  },
  listContent: {
    paddingBottom: 8
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden'
  },
  reorderBtns: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    gap: 2
  },
  reorderSpacer: {
    width: 36,
    alignSelf: 'stretch'
  },
  reorderBtn: {
    width: 32,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center'
  },
  itemBody: {
    flex: 1,
    paddingVertical: 10,
    paddingRight: 4
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600'
  },
  itemContent: {
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 6,
    gap: 4
  },
  useBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginRight: 2
  },
  actionBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center'
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16
  },
  emptyText: {
    fontSize: 15,
    textAlign: 'center'
  },
  emptyAddBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10
  },
  paginationBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  pageMeta: {
    fontSize: 13
  },
  pageNavBtns: {
    flexDirection: 'row',
    gap: 8
  },
  pageNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center'
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6
  },
  fieldInput: {
    fontSize: 15,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  fieldTextArea: {
    minHeight: 120,
    maxHeight: 180
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 20
  },
  formBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth
  },
  formBtnPrimary: {
    borderWidth: 0
  }
})
