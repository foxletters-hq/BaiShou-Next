import { Platform, StyleSheet } from 'react-native'
import { mobileTypography, sharedTokens } from '@baishou/ui/theme/tokens'

const APP_BAR_MIN_HEIGHT = 56

export const diaryAppBarStyles = StyleSheet.create({
  appBar: {
    paddingHorizontal: sharedTokens.spacing.md,
    paddingVertical: sharedTokens.spacing.sm,
    borderBottomWidth: 1,
    minHeight: APP_BAR_MIN_HEIGHT,
    justifyContent: 'center'
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: sharedTokens.spacing.sm,
    minHeight: 40
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.sm,
    flexShrink: 1
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.xs,
    flexShrink: 0
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.xs,
    minHeight: 40
  },
  searchPendingSpinner: {
    marginRight: sharedTokens.spacing.xs
  },
  searchSectionWrap: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center'
  },
  searchInputBox: {
    height: 40,
    borderRadius: sharedTokens.radius.control,
    borderWidth: 1,
    paddingHorizontal: sharedTokens.spacing.mdTight,
    justifyContent: 'center'
  },
  searchInput: {
    flex: 1,
    fontSize: mobileTypography.secondary.fontSize,
    height: 40,
    paddingVertical: 0,
    paddingHorizontal: 0,
    margin: 0,
    backgroundColor: 'transparent',
    ...(Platform.OS === 'android'
      ? { includeFontPadding: false, textAlignVertical: 'center' as const }
      : { paddingTop: 0, paddingBottom: 0 })
  },
  closeSearchBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center'
  },
  filterBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: sharedTokens.radius.sm
  },
  filterBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: sharedTokens.radius.xs
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end'
  },
  filterPanel: {
    borderTopLeftRadius: sharedTokens.radius.lg,
    borderTopRightRadius: sharedTokens.radius.lg,
    maxHeight: '70%',
    paddingBottom: sharedTokens.spacing.lg
  },
  filterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: sharedTokens.spacing.md,
    paddingVertical: sharedTokens.spacing.mdSnug,
    borderBottomWidth: 1
  },
  filterTitle: {
    fontSize: mobileTypography.primary.fontSize,
    fontWeight: '600'
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.xs
  },
  clearText: {
    fontSize: mobileTypography.secondary.fontSize
  },
  filterBody: {
    paddingHorizontal: sharedTokens.spacing.md,
    paddingTop: sharedTokens.spacing.mdTight
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.sm,
    paddingHorizontal: sharedTokens.spacing.mdTight,
    paddingVertical: sharedTokens.spacing.smPlus,
    borderRadius: sharedTokens.radius.sm,
    marginBottom: sharedTokens.spacing.mdTight
  },
  filterOptionText: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '500'
  },
  filterSectionLabel: {
    fontSize: mobileTypography.caption.fontSize,
    fontWeight: '500',
    marginBottom: sharedTokens.spacing.sm
  },
  weatherList: {
    marginBottom: sharedTokens.spacing.md,
    gap: sharedTokens.spacing.xxs
  },
  weatherOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.smPlus,
    paddingHorizontal: sharedTokens.spacing.mdTight,
    paddingVertical: sharedTokens.spacing.smPlus,
    borderRadius: sharedTokens.radius.sm
  },
  weatherOptionLabel: {
    flex: 1,
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '500'
  },
  weatherCheckPlaceholder: {
    width: 18
  },
  filterDoneBtn: {
    marginHorizontal: sharedTokens.spacing.md,
    marginTop: sharedTokens.spacing.sm,
    paddingVertical: sharedTokens.spacing.mdTight,
    borderRadius: sharedTokens.radius.md,
    alignItems: 'center'
  },
  filterDoneText: {
    fontSize: mobileTypography.body.fontSize,
    fontWeight: '600'
  }
})
