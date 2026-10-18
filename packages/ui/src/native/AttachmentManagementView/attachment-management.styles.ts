import { StyleSheet } from 'react-native'
import { mobileTypography, sharedTokens } from '../../theme/tokens'

export const attachmentManagementStyles = StyleSheet.create({
  container: {
    flex: 1
  },
  mainTabNav: {
    marginBottom: sharedTokens.spacing.mdTight
  },
  mainTabs: {
    flexDirection: 'row',
    borderRadius: sharedTokens.radius.sm,
    padding: sharedTokens.spacing.xs,
    gap: sharedTokens.spacing.sm
  },
  mainTabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: sharedTokens.spacing.xsPlus,
    paddingHorizontal: sharedTokens.spacing.md,
    borderRadius: sharedTokens.radius.xsPlus
  },
  mainTabText: {
    fontSize: mobileTypography.secondary.fontSize,
    lineHeight: 18.9,
    fontWeight: '400'
  },
  overviewCard: {
    flexDirection: 'row',
    borderRadius: sharedTokens.radius.md,
    padding: sharedTokens.spacing.mdSnug,
    marginBottom: sharedTokens.spacing.mdTight,
    borderWidth: 1
  },
  statColumn: {
    flex: 1,
    alignItems: 'center'
  },
  statDivider: {
    width: 1,
    alignSelf: 'stretch',
    marginHorizontal: sharedTokens.spacing.xs
  },
  statLabel: {
    fontSize: mobileTypography.caption.fontSize,
    marginBottom: sharedTokens.spacing.xs,
    textAlign: 'center'
  },
  statValue: {
    fontSize: mobileTypography.primary.fontSize,
    fontWeight: '600',
    textAlign: 'center'
  },
  toolbar: {
    gap: sharedTokens.spacing.smPlus,
    marginBottom: sharedTokens.spacing.mdTight
  },
  tabRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: sharedTokens.spacing.sm
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: sharedTokens.spacing.sm
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.xs,
    paddingHorizontal: sharedTokens.spacing.smPlus,
    paddingVertical: sharedTokens.spacing.sm,
    borderRadius: sharedTokens.radius.sm,
    borderWidth: 1
  },
  filterChipText: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '500'
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.xs,
    paddingHorizontal: sharedTokens.spacing.mdTight,
    paddingVertical: sharedTokens.spacing.sm,
    borderRadius: sharedTokens.radius.sm,
    borderWidth: 1
  },
  actionBtnText: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '600'
  },
  paginationRow: {
    gap: sharedTokens.spacing.mdTight,
    marginVertical: sharedTokens.spacing.mdTight
  },
  folderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: sharedTokens.spacing.mdTight,
    borderRadius: sharedTokens.radius.control,
    borderWidth: 1,
    marginBottom: sharedTokens.spacing.sm
  },
  folderIconBox: {
    width: 40,
    height: 40,
    borderRadius: sharedTokens.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: sharedTokens.spacing.smPlus
  },
  folderInfo: {
    flex: 1,
    minWidth: 0
  },
  folderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.xsPlus,
    flexWrap: 'wrap'
  },
  folderTitle: {
    fontSize: mobileTypography.body.fontSize,
    fontWeight: '600',
    flexShrink: 1
  },
  orphanBadge: {
    paddingHorizontal: sharedTokens.spacing.xsPlus,
    paddingVertical: sharedTokens.spacing.xxs,
    borderRadius: sharedTokens.radius.xs
  },
  orphanBadgeText: {
    fontSize: mobileTypography.caption.fontSize,
    fontWeight: '600'
  },
  folderSubtitle: {
    fontSize: mobileTypography.caption.fontSize,
    marginTop: sharedTokens.spacing.xxs
  },
  folderSize: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '600',
    marginRight: sharedTokens.spacing.sm
  },
  folderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.xs
  },
  iconBtn: {
    padding: sharedTokens.spacing.xsPlus,
    borderRadius: sharedTokens.radius.xsPlus
  },
  sessionFileListCard: {
    marginBottom: sharedTokens.spacing.sm,
    borderRadius: sharedTokens.radius.control,
    borderWidth: 1,
    padding: sharedTokens.spacing.sm,
    gap: sharedTokens.spacing.xs
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: sharedTokens.spacing.sm,
    paddingHorizontal: sharedTokens.spacing.xs,
    gap: sharedTokens.spacing.smPlus
  },
  sessionFileThumb: {
    width: 56,
    height: 56,
    borderRadius: sharedTokens.radius.sm,
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
    fontSize: mobileTypography.secondary.fontSize
  },
  fileSize: {
    fontSize: mobileTypography.caption.fontSize
  },
  fileActions: {
    flexDirection: 'row',
    gap: sharedTokens.spacing.xs
  },
  diaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: sharedTokens.spacing.smPlus
  },
  diaryCard: {
    width: '47%',
    borderRadius: sharedTokens.radius.control,
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
    padding: sharedTokens.spacing.sm
  },
  diaryCardTitle: {
    fontSize: mobileTypography.caption.fontSize,
    fontWeight: '600',
    marginBottom: sharedTokens.spacing.xxs
  },
  diaryCardMeta: {
    fontSize: mobileTypography.caption.fontSize
  },
  diaryCardActions: {
    position: 'absolute',
    top: 6,
    right: 6,
    flexDirection: 'row',
    gap: sharedTokens.spacing.xs
  },
  diaryOrphanBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    paddingHorizontal: sharedTokens.spacing.xsPlus,
    paddingVertical: sharedTokens.spacing.xxs,
    borderRadius: sharedTokens.radius.xs
  },
  diaryCheckbox: {
    position: 'absolute',
    bottom: 6,
    left: 6
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: sharedTokens.spacing.xlPlus,
    gap: sharedTokens.spacing.sm
  },
  emptyText: {
    fontSize: mobileTypography.secondary.fontSize,
    textAlign: 'center',
    paddingHorizontal: sharedTokens.spacing.lg
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: sharedTokens.spacing.xlPlus
  }
})
