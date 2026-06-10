import { StyleSheet } from 'react-native'

export const attachmentManagementStyles = StyleSheet.create({
  container: {
    flex: 1
  },
  mainTabNav: {
    marginBottom: 12
  },
  mainTabs: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 4,
    gap: 4
  },
  mainTabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8
  },
  mainTabText: {
    fontSize: 14,
    fontWeight: '600'
  },
  overviewCard: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1
  },
  statColumn: {
    flex: 1,
    alignItems: 'center'
  },
  statDivider: {
    width: 1,
    alignSelf: 'stretch',
    marginHorizontal: 4
  },
  statLabel: {
    fontSize: 11,
    marginBottom: 4,
    textAlign: 'center'
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center'
  },
  toolbar: {
    gap: 10,
    marginBottom: 12
  },
  tabRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '500'
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '600'
  },
  paginationRow: {
    gap: 12,
    marginVertical: 12
  },
  folderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8
  },
  folderIconBox: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10
  },
  folderInfo: {
    flex: 1,
    minWidth: 0
  },
  folderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap'
  },
  folderTitle: {
    fontSize: 15,
    fontWeight: '600',
    flexShrink: 1
  },
  orphanBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  orphanBadgeText: {
    fontSize: 10,
    fontWeight: '700'
  },
  folderSubtitle: {
    fontSize: 12,
    marginTop: 2
  },
  folderSize: {
    fontSize: 13,
    fontWeight: '600',
    marginRight: 8
  },
  folderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  iconBtn: {
    padding: 6,
    borderRadius: 6
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10
  },
  checkmark: {
    fontSize: 13,
    fontWeight: '700'
  },
  sessionFileListCard: {
    marginBottom: 8,
    borderRadius: 10,
    borderWidth: 1,
    padding: 8,
    gap: 4
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    gap: 10
  },
  sessionFileThumb: {
    width: 56,
    height: 56,
    borderRadius: 8,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1
  },
  sessionFileThumbImage: {
    width: '100%',
    height: '100%'
  },
  fileName: {
    flex: 1,
    fontSize: 13
  },
  fileSize: {
    fontSize: 12
  },
  fileActions: {
    flexDirection: 'row',
    gap: 4
  },
  diaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  diaryCard: {
    width: '47%',
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden'
  },
  diaryPreview: {
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden'
  },
  diaryPreviewImage: {
    width: '100%',
    height: '100%'
  },
  diaryCardInfo: {
    padding: 8
  },
  diaryCardTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2
  },
  diaryCardMeta: {
    fontSize: 11
  },
  diaryCardActions: {
    position: 'absolute',
    top: 6,
    right: 6,
    flexDirection: 'row',
    gap: 4
  },
  diaryOrphanBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  diaryCheckbox: {
    position: 'absolute',
    bottom: 6,
    left: 6
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 8
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 24
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40
  }
})
