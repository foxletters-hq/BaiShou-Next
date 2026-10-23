import { Platform, StyleSheet } from 'react-native'
import { mobileTypography, sharedTokens } from '../../theme/tokens'

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
    borderRadius: sharedTokens.radius.lgPlus,
    overflow: 'hidden',
    flexDirection: 'column'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: sharedTokens.spacing.md,
    paddingVertical: sharedTokens.spacing.mdTight,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: sharedTokens.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: sharedTokens.spacing.mdTight
  },
  searchSection: {
    paddingHorizontal: sharedTokens.spacing.md,
    paddingTop: sharedTokens.spacing.mdTight,
    paddingBottom: sharedTokens.spacing.mdTight,
    gap: sharedTokens.spacing.mdTight
  },
  searchBox: {
    borderRadius: sharedTokens.radius.md,
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
    fontSize: mobileTypography.secondary.fontSize,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    paddingLeft: 38,
    paddingRight: sharedTokens.spacing.xlPlus,
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
  listArea: {
    flex: 1
  },
  listContent: {
    paddingHorizontal: sharedTokens.spacing.md,
    paddingTop: sharedTokens.spacing.md,
    paddingBottom: sharedTokens.spacing.lg,
    gap: sharedTokens.spacing.mdTight
  },
  diaryWrap: {
    gap: sharedTokens.spacing.mdTight
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: sharedTokens.spacing.xlPlus,
    gap: sharedTokens.spacing.sm
  },
  emptyText: {
    fontSize: mobileTypography.secondary.fontSize,
    textAlign: 'center',
    lineHeight: 22
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: sharedTokens.spacing.md,
    paddingVertical: sharedTokens.spacing.smPlus,
    borderTopWidth: StyleSheet.hairlineWidth
  },
  selectionCount: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '600'
  },
  paginationArea: {
    paddingHorizontal: sharedTokens.spacing.md,
    paddingTop: sharedTokens.spacing.sm,
    paddingBottom: sharedTokens.spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth
  }
})
