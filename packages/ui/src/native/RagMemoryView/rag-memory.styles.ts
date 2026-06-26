import { StyleSheet } from 'react-native'

export const ragMemoryStyles = StyleSheet.create({
  root: {},
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
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  statChip: {
    flexGrow: 1,
    flexBasis: '46%',
    minWidth: 132,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    gap: 4
  },
  statValue: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  statLabel: { fontSize: 11, textAlign: 'center' },
  alertBox: {
    marginTop: 12,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4
  },
  migrationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4
  },
  alertDesc: {
    fontSize: 13,
    lineHeight: 18
  },
  alertAction: {
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    alignSelf: 'flex-start'
  },
  progressBox: {
    marginBottom: 12
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
    gap: 10
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1
  },
  actionBtnOutlined: {
    borderWidth: 1
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '500',
    flexShrink: 1,
    textAlign: 'center'
  },
  entryCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
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
  emptyBox: {
    paddingVertical: 24,
    alignItems: 'center'
  },
  menuOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1
  },
  entryMenu: {
    position: 'absolute',
    right: 0,
    top: 28,
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
  paginationRow: {
    paddingTop: 12,
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
  bottomSpacer: { height: 16 }
})
