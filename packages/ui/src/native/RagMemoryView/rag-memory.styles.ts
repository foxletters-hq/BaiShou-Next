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
    marginRight: 12,
    letterSpacing: -0.5
  },
  headerSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6
  },
  clearAllBtn: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: 20,
    alignItems: 'center',
    alignSelf: 'flex-start'
  },
  clearAllText: {
    fontSize: 13,
    fontWeight: '600'
  },
  disabledAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12
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
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  statChip: {
    flex: 1,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderWidth: 1
  },
  statValue: { fontSize: 15, fontWeight: '700' },
  statLabel: { fontSize: 11, marginTop: 2 },
  statChipBlue: {
    borderWidth: 1
  },
  statChipGreen: {
    borderWidth: 1
  },
  statChipGrey: {
    borderWidth: 1
  },
  warningBox: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 12
  },
  warningText: { fontSize: 13, fontWeight: '500' },
  dangerAlert: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1
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
  progressBox: {
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  statusText: { fontSize: 14, fontWeight: '500', marginBottom: 8 },
  progressBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden'
  },
  progressFill: {
    height: '100%',
    borderRadius: 3
  },
  progressLabel: { fontSize: 12, marginTop: 6, textAlign: 'right' },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    marginBottom: 8,
    flexWrap: 'wrap'
  },
  actionBtn: { flex: 1, minWidth: 140 },
  actionBtnBlue: {
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1
  },
  actionBtnGreen: {
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center'
  },
  searchInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    borderRadius: 12,
    borderWidth: 1
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
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 16,
    marginVertical: 5,
    flexDirection: 'row',
    gap: 12
  },
  entryIconBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 2
  },
  entryBraces: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'monospace'
  },
  entryContent: {
    flex: 1
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  entryModel: { fontSize: 12, fontWeight: '600', flex: 1 },
  deleteBtn: { fontSize: 13, fontWeight: '500' },
  entryText: { fontSize: 13, lineHeight: 19, marginBottom: 8 },
  entryFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  entryDate: { fontSize: 11 },
  entrySimilarity: {
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  bottomSpacer: { height: 40 },
  configBlock: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden'
  },
  configBlockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  configBlockTitle: {
    fontSize: 14,
    fontWeight: '600'
  },
  paramSliderRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 4
  },
  paramLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  paramLabel: {
    fontSize: 13
  },
  paramValue: {
    fontSize: 14,
    fontWeight: '700'
  }
})
