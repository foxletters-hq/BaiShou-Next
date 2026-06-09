import { StyleSheet } from 'react-native'

export const agentSessionListStyles = StyleSheet.create({
  container: { flex: 1 },
  searchBar: {
    margin: 12
  },
  searchInput: { fontSize: 15 },
  clearIcon: { fontSize: 18, paddingHorizontal: 6 },
  groupHeader: { paddingHorizontal: 16, paddingVertical: 8 },
  groupLabel: { fontSize: 13, fontWeight: '600' },
  item: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  itemContent: { flex: 1 },
  itemHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  pinIcon: { fontSize: 13, marginRight: 4 },
  itemTitle: { fontSize: 16, flex: 1 },
  itemMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  itemTime: { fontSize: 12 },
  itemCount: { fontSize: 12 },
  emptyContainer: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 15 },
  footerLoader: { paddingVertical: 16, alignItems: 'center' }
})
