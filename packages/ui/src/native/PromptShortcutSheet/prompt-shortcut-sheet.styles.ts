import { StyleSheet } from 'react-native'
import { iconSizes, mobileTypography, sharedTokens } from '../../theme/tokens'

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
    marginBottom: sharedTokens.spacing.mdTight
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.smPlus
  },
  headerText: {
    fontSize: mobileTypography.title.fontSize,
    fontWeight: '600',
    flex: 1
  },
  closeIcon: {
    fontSize: iconSizes.lg,
    lineHeight: 24
  },
  addBtn: {
    paddingHorizontal: sharedTokens.spacing.smPlus,
    paddingVertical: sharedTokens.spacing.xsPlus,
    borderRadius: sharedTokens.radius.sm
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    paddingHorizontal: sharedTokens.spacing.mdTight,
    marginBottom: sharedTokens.spacing.sm,
    gap: sharedTokens.spacing.sm,
    borderRadius: sharedTokens.radius.control,
    borderWidth: 1
  },
  searchInput: {
    flex: 1,
    fontSize: mobileTypography.body.fontSize,
    paddingVertical: 0,
    height: 40
  },
  slashHint: {
    fontSize: mobileTypography.secondary.fontSize,
    lineHeight: 18,
    marginBottom: sharedTokens.spacing.smPlus,
    paddingHorizontal: sharedTokens.spacing.mdTight,
    paddingVertical: sharedTokens.spacing.smPlus,
    borderRadius: sharedTokens.radius.control,
    borderWidth: StyleSheet.hairlineWidth
  },
  dragHint: {
    fontSize: mobileTypography.secondary.fontSize,
    lineHeight: 18,
    marginBottom: sharedTokens.spacing.sm
  },
  listArea: {
    flex: 1,
    minHeight: 160,
    overflow: 'hidden'
  },
  list: {
    flex: 1
  },
  listContent: {
    paddingBottom: sharedTokens.spacing.sm
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: sharedTokens.radius.md,
    marginBottom: sharedTokens.spacing.smPlus,
    borderWidth: 1,
    paddingVertical: sharedTokens.spacing.smPlus,
    paddingHorizontal: sharedTokens.spacing.mdTight,
    position: 'relative'
  },
  itemBody: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    justifyContent: 'center',
    paddingRight: sharedTokens.spacing.xsPlus,
    paddingLeft: sharedTokens.spacing.xxs
  },
  itemBodyPress: {
    flex: 1,
    justifyContent: 'center'
  },
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: sharedTokens.spacing.xsPlus
  },
  itemCommand: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '600'
  },
  itemName: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '500'
  },
  systemBadge: {
    paddingHorizontal: sharedTokens.spacing.xsPlus,
    paddingVertical: sharedTokens.spacing.xxs,
    borderRadius: sharedTokens.radius.xs
  },
  systemBadgeText: {
    fontSize: mobileTypography.caption.fontSize,
    fontWeight: '600'
  },
  itemContent: {
    fontSize: mobileTypography.secondary.fontSize,
    marginTop: sharedTokens.spacing.xs,
    lineHeight: 18
  },
  itemActions: {
    width: 30,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative'
  },
  useBtn: {
    paddingHorizontal: sharedTokens.spacing.mdTight,
    paddingVertical: sharedTokens.spacing.xsPlus,
    borderRadius: sharedTokens.radius.sm
  },
  moreBtn: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: sharedTokens.radius.xsPlus
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: sharedTokens.spacing.md
  },
  emptyText: {
    fontSize: mobileTypography.secondary.fontSize,
    textAlign: 'center'
  },
  emptyAddBtn: {
    paddingHorizontal: sharedTokens.spacing.md,
    paddingVertical: sharedTokens.spacing.smPlus,
    borderRadius: sharedTokens.radius.control
  },
  paginationBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: sharedTokens.spacing.mdTight,
    marginTop: sharedTokens.spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  pageMeta: {
    fontSize: mobileTypography.secondary.fontSize
  },
  pageNavBtns: {
    flexDirection: 'row',
    gap: sharedTokens.spacing.sm
  },
  pageNavBtn: {
    width: 36,
    height: 36,
    borderRadius: sharedTokens.radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center'
  },
  editorRoot: {
    flex: 1
  },
  editorScroll: {
    flex: 1
  },
  editorScrollContent: {
    paddingRight: 0,
    paddingLeft: 0
  },
  fieldBlock: {
    width: '100%',
    alignSelf: 'stretch'
  },
  fieldControl: {
    width: '100%',
    alignSelf: 'stretch'
  },
  fieldLabel: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '600',
    marginBottom: sharedTokens.spacing.xsPlus
  },
  fieldInput: {
    fontSize: mobileTypography.body.fontSize,
    borderRadius: sharedTokens.radius.control,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: sharedTokens.spacing.mdTight,
    paddingVertical: sharedTokens.spacing.smPlus
  },
  fieldTextArea: {
    minHeight: sharedTokens.spacing.xxxl * 3 + sharedTokens.spacing.xl,
    maxHeight: sharedTokens.spacing.xxxl * 3 + sharedTokens.spacing.xl,
    width: '100%'
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: sharedTokens.spacing.smPlus,
    marginTop: sharedTokens.spacing.mdPlus
  },
  formBtn: {
    paddingHorizontal: sharedTokens.spacing.mdSnug,
    paddingVertical: sharedTokens.spacing.sm,
    borderRadius: sharedTokens.radius.sm,
    borderWidth: StyleSheet.hairlineWidth
  },
  formBtnPrimary: {
    borderWidth: 0
  }
})
