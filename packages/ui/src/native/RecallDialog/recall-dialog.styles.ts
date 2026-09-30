import { Platform, StyleSheet } from 'react-native'

export const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  dialogWrap: {
    width: '100%',
    alignItems: 'center',
    zIndex: 2
  },
  dialog: {
    borderRadius: 20,
    overflow: 'hidden',
    flexDirection: 'column'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  tabs: {
    flexDirection: 'row',
    gap: 0,
    padding: 3,
    borderRadius: 10,
    borderWidth: 1
  },
  tab: {
    height: 28,
    paddingHorizontal: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center'
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 12
  },
  searchBox: {
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: 'center'
  },
  searchInputInner: {
    position: 'relative',
    minHeight: 44,
    justifyContent: 'center'
  },
  searchIconInside: {
    position: 'absolute',
    left: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    paddingLeft: 38,
    paddingRight: 36,
    minHeight: 44,
    ...(Platform.OS === 'android'
      ? { includeFontPadding: false, textAlignVertical: 'center' }
      : null)
  },
  searchClearBtn: {
    position: 'absolute',
    right: 10,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    zIndex: 1
  },
  segmented: {
    flexDirection: 'row',
    width: '100%',
    padding: 3,
    borderRadius: 10,
    borderWidth: 1,
    gap: 0
  },
  segmentBtn: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center'
  },
  segmentText: {
    fontSize: 14,
    lineHeight: 18.9,
    fontWeight: '400'
  },
  listArea: {
    flex: 1
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 12
  },
  diaryWrap: {
    gap: 12
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 8
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth
  },
  selectionCount: {
    fontSize: 14,
    fontWeight: '600'
  },
  paginationArea: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    borderTopWidth: StyleSheet.hairlineWidth
  }
})
