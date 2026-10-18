import { StyleSheet } from 'react-native'
import { mobileTypography, sharedTokens } from '@baishou/ui/theme/tokens'

export const dataSyncScreenStyles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: {
    paddingHorizontal: sharedTokens.spacing.md,
    paddingTop: sharedTokens.spacing.md
  },
  topSwitcherContainer: { marginBottom: sharedTokens.spacing.md },
  section: {
    borderRadius: sharedTokens.radius.lg,
    padding: sharedTokens.spacing.md,
    marginBottom: sharedTokens.spacing.md
  },
  backupScopeWrapper: {
    marginTop: sharedTokens.spacing.xs,
    marginBottom: sharedTokens.spacing.sm
  },
  statCardsRow: {
    flexDirection: 'column',
    gap: sharedTokens.spacing.smPlus,
    borderRadius: sharedTokens.radius.md,
    borderWidth: 1,
    padding: sharedTokens.spacing.mdSnug,
    marginBottom: sharedTokens.spacing.md
  },
  statCard: { flexDirection: 'row', alignItems: 'center', gap: sharedTokens.spacing.mdTight },
  statIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: sharedTokens.radius.control,
    alignItems: 'center',
    justifyContent: 'center'
  },
  statInfo: { flex: 1 },
  statLabel: {
    fontSize: mobileTypography.caption.fontSize,
    marginBottom: sharedTokens.spacing.xxs
  },
  statValue: { fontSize: mobileTypography.title.fontSize, fontWeight: '600' },
  headerTitleRow: { marginBottom: sharedTokens.spacing.smPlus },
  headerTitleBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.sm,
    flexWrap: 'wrap'
  },
  headerTitleLabel: { fontSize: mobileTypography.primary.fontSize, fontWeight: '600' },
  targetBadge: {
    paddingHorizontal: sharedTokens.spacing.sm,
    paddingVertical: sharedTokens.spacing.xxs,
    borderRadius: sharedTokens.radius.md,
    borderWidth: 1
  },
  headerActionsGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: sharedTokens.spacing.sm,
    marginTop: sharedTokens.spacing.xs
  },
  headerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: sharedTokens.spacing.smPlus,
    paddingVertical: sharedTokens.spacing.sm,
    borderRadius: sharedTokens.radius.sm,
    borderWidth: 1
  },
  emptyContainer: {
    alignItems: 'center',
    padding: sharedTokens.spacing.xl,
    gap: sharedTokens.spacing.sm
  },
  emptyText: { fontSize: mobileTypography.body.fontSize, fontWeight: '600', textAlign: 'center' },
  emptySubText: {
    fontSize: mobileTypography.secondary.fontSize,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 320
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.xsPlus,
    marginTop: sharedTokens.spacing.sm,
    paddingHorizontal: sharedTokens.spacing.mdSnug,
    paddingVertical: sharedTokens.spacing.sm,
    borderRadius: sharedTokens.radius.sm,
    borderWidth: 1
  },
  settingsLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.xsPlus,
    marginTop: sharedTokens.spacing.xs,
    paddingHorizontal: sharedTokens.spacing.mdSnug,
    paddingVertical: sharedTokens.spacing.sm
  },
  loadingContainer: { alignItems: 'center', padding: sharedTokens.spacing.xl },
  loadingText: { fontSize: mobileTypography.secondary.fontSize },
  recordList: {
    borderRadius: sharedTokens.radius.control,
    borderWidth: 1,
    overflow: 'hidden'
  },
  recordItem: {
    padding: sharedTokens.spacing.mdTight,
    flexDirection: 'row',
    alignItems: 'center'
  },
  recordInfo: { flex: 1 },
  recordName: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '600',
    marginBottom: sharedTokens.spacing.xxs
  },
  recordMeta: { fontSize: mobileTypography.caption.fontSize },
  recordActions: {
    flexDirection: 'row',
    gap: sharedTokens.spacing.xsPlus,
    marginLeft: sharedTokens.spacing.xs
  },
  recordAction: {
    paddingHorizontal: sharedTokens.spacing.sm,
    paddingVertical: sharedTokens.spacing.xsPlus,
    borderRadius: sharedTokens.radius.xsPlus
  },
  recordActionText: { fontSize: mobileTypography.caption.fontSize, fontWeight: '600' },
  renameContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.sm
  },
  renameConfirm: {
    paddingHorizontal: sharedTokens.spacing.mdTight,
    paddingVertical: sharedTokens.spacing.sm,
    borderRadius: sharedTokens.radius.xsPlus
  },
  renameConfirmText: { fontSize: mobileTypography.secondary.fontSize, fontWeight: '600' },
  renameCancel: { padding: sharedTokens.spacing.sm },
  renameCancelText: { fontSize: mobileTypography.secondary.fontSize, fontWeight: '600' }
})
