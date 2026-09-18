import { StyleSheet } from 'react-native'

export const styles = StyleSheet.create({
  layoutContent: {
    flex: 1,
    position: 'relative'
  },
  bootShell: {
    flex: 1
  },
  tabTrack: {
    flexDirection: 'row',
    gap: 6,
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 8,
    padding: 4,
    borderRadius: 12
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent'
  },
  status: {
    paddingHorizontal: 16,
    marginBottom: 8,
    fontSize: 13
  },
  graphBody: {
    flex: 1
  },
  pendingPane: {
    flex: 1
  },
  pendingList: {
    flex: 1
  },
  pendingToolbar: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8
  },
  pendingHintText: {
    fontSize: 12,
    lineHeight: 18
  },
  pendingToolbarRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12
  },
  pendingSelectAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  pendingTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10
  },
  webWrap: {
    flex: 1
  },
  toolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  toolBtn: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth
  },
  depthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingBottom: 6
  },
  depthLabel: {
    fontSize: 12,
    marginRight: 2
  },
  depthChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6
  },
  forceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  forceLabel: {
    width: 44,
    fontSize: 12
  },
  forceLabelWide: {
    width: 72,
    fontSize: 11
  },
  forceValue: {
    width: 36,
    fontSize: 11,
    textAlign: 'right'
  },
  detailPanel: {
    maxHeight: 280,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  detailPanelContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 6
  },
  renameInput: {
    fontSize: 14,
    fontWeight: '600',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  multilineInput: {
    minHeight: 56,
    fontWeight: '400',
    textAlignVertical: 'top'
  },
  detailMeta: {
    fontSize: 12
  },
  incidentBlock: {
    gap: 6,
    marginTop: 4
  },
  incidentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8
  },
  guide: {
    padding: 24,
    gap: 12
  },
  guideTitle: {
    fontSize: 17,
    fontWeight: '700'
  },
  guideBody: {
    fontSize: 14,
    lineHeight: 22
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    marginBottom: 8
  },
  searchModeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 10
  },
  searchModeChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1
  },
  card: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600'
  },
  cardMeta: {
    fontSize: 12,
    marginTop: 4,
    lineHeight: 18
  },
  row: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 10,
    flexWrap: 'wrap'
  },
  queueModalPad: {
    padding: 18
  },
  queueModalSubtitle: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4
  },
  concurrencyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: 10
  },
  concurrencyChip: {
    minWidth: 28,
    height: 28,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  queueModalList: {
    maxHeight: 280,
    marginTop: 8
  },
  queueOverallRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 12
  },
  queueOverallPct: {
    fontSize: 13,
    fontWeight: '600'
  },
  queueModalItem: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(127,127,127,0.2)'
  },
  queueModalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14
  },
  queueDockItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  queueDockName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500'
  },
  queueProgress: {
    marginTop: 6,
    height: 3,
    borderRadius: 999,
    overflow: 'hidden'
  },
  queueProgressBar: {
    height: '100%',
    borderRadius: 999
  },
  addEdgeSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  edgeTypeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  edgeTypeChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth
  },
  hitBtn: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 2
  },
  modalPad: {
    padding: 16,
    gap: 10
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4
  },
  filterSectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4
  },
  typeChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  settingsHead: {
    paddingVertical: 8
  },
  settingsBody: {
    gap: 8,
    paddingBottom: 8
  },
  opsLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  opsBtnRow: {
    flexDirection: 'row',
    gap: 8
  },
  opsPrimaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10
  },
  sourceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10
  },
  sourceTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700'
  },
  sourceLoading: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center'
  },
  sourceScroll: {
    maxHeight: 420
  },
  sourceScrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 20
  }
})
