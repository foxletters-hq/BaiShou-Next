import { StyleSheet } from 'react-native'

export const ragMemoryStyles = StyleSheet.create({
  scroll: { flex: 1 },
  headerBlock: {},
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    flex: 1,
    marginRight: 12
  },
  headerSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6
  },
  clearAllBtn: {
    marginTop: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center'
  },
  clearAllText: {
    fontSize: 14,
    fontWeight: '600'
  },
  disabledAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10
  },
  disabledAlertText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18
  },
  statsCard: {
    overflow: 'hidden'
  },
  warningAction: {
    marginTop: 8
  },
  paginationRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10
  },
  paginationInfo: {
    fontSize: 13
  },
  pageSizeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8
  },
  pageSizeChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1
  },
  emptyBox: {
    padding: 24,
    alignItems: 'center'
  },
  menuOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1
  },
  entryMenu: {
    position: 'absolute',
    right: 12,
    top: 36,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 4,
    minWidth: 120,
    zIndex: 2,
    elevation: 4
  },
  menuItem: {
    paddingVertical: 10,
    paddingHorizontal: 14
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14
  },
  rowText: { flex: 1, marginRight: 12 },
  rowTitle: { fontSize: 15, fontWeight: '500' },
  rowSubtitle: { fontSize: 13, marginTop: 2 },
  divider: { height: 1 },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  statChip: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center'
  },
  statValue: { fontSize: 16, fontWeight: '600' },
  statLabel: { fontSize: 11, marginTop: 2 },
  warningBox: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 8,
    padding: 10
  },
  warningText: { fontSize: 13, fontWeight: '500' },
  dangerAlert: {
    padding: 12
  },
  dangerTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4
  },
  dangerDesc: {
    fontSize: 13,
    lineHeight: 18
  },
  fieldGroup: {
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  label: { fontSize: 14, fontWeight: '500', marginBottom: 4 },
  hint: { fontSize: 12, lineHeight: 18, marginTop: 6, paddingHorizontal: 16, paddingBottom: 8 },
  slider: { width: '100%', height: 40 },
  progressBox: {
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  statusText: { fontSize: 14, fontWeight: '500', marginBottom: 8 },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden'
  },
  progressFill: {
    height: '100%',
    borderRadius: 4
  },
  progressLabel: { fontSize: 12, marginTop: 6, textAlign: 'right' },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 8
  },
  actionBtn: { flex: 1 },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center'
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12
  },
  modeChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1
  },
  modeText: { fontSize: 13, fontWeight: '500' },
  entryCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginHorizontal: 16,
    marginVertical: 4
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  entryModel: { fontSize: 12, fontWeight: '600', flex: 1 },
  deleteBtn: { fontSize: 13, fontWeight: '500' },
  entryText: { fontSize: 13, lineHeight: 18, marginBottom: 6 },
  entryFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  entryDate: { fontSize: 11 },
  entrySimilarity: { fontSize: 11 },
  bottomSpacer: { height: 40 }
})
