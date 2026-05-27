import { StyleSheet } from 'react-native'

export const attachmentManagementStyles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: 24
  },
  statDivider: {
    width: 1,
    height: 28
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700'
  },
  statLabel: {
    fontSize: 12,
    marginTop: 2
  },
  listContent: {
    padding: 12
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1.5
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700'
  },
  itemInfo: {
    flex: 1
  },
  filename: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4
  },
  itemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  mimeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  mimeText: {
    fontSize: 10,
    fontWeight: '700'
  },
  metaText: {
    fontSize: 12
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40
  },
  emptyText: {
    fontSize: 14
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1
  },
  selectionInfo: {
    fontSize: 13
  },
  deleteButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center'
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: '600'
  }
})
