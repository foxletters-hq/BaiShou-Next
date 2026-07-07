import { StyleSheet } from 'react-native'

export const dataSyncScreenStyles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16 },
  section: { borderRadius: 16, padding: 16, marginBottom: 16 },
  backupScopeWrapper: {
    marginTop: 4,
    marginBottom: 8
  },
  statCardsRow: {
    flexDirection: 'column',
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16
  },
  statCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  statInfo: { flex: 1 },
  statLabel: { fontSize: 12, marginBottom: 3 },
  statValue: { fontSize: 17, fontWeight: '600' },
  backupTabBar: { flexDirection: 'row', borderRadius: 10, padding: 4, marginBottom: 12 },
  backupTab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  headerTitleRow: { marginBottom: 10 },
  headerTitleBlock: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  headerTitleLabel: { fontSize: 16, fontWeight: '700' },
  targetBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1
  },
  headerActionsGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: 4
  },
  headerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1
  },
  emptyContainer: { alignItems: 'center', padding: 32, gap: 8 },
  emptyText: { fontSize: 15, fontWeight: '600', textAlign: 'center' },
  emptySubText: { fontSize: 13, textAlign: 'center', lineHeight: 20, maxWidth: 320 },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1
  },
  settingsLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    paddingHorizontal: 14,
    paddingVertical: 8
  },
  loadingContainer: { alignItems: 'center', padding: 32 },
  loadingText: { fontSize: 14 },
  recordList: {
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden'
  },
  recordItem: {
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center'
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderRadius: 4,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  checkmark: { fontSize: 14, fontWeight: '700' },
  recordInfo: { flex: 1 },
  recordName: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  recordMeta: { fontSize: 11 },
  recordActions: { flexDirection: 'row', gap: 6, marginLeft: 4 },
  recordAction: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 6 },
  recordActionText: { fontSize: 11, fontWeight: '600' },
  renameContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  renameConfirm: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6 },
  renameConfirmText: { fontSize: 13, fontWeight: '600' },
  renameCancel: { padding: 8 },
  renameCancelText: { fontSize: 13, fontWeight: '600' }
})
