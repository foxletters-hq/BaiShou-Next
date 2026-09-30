import { StyleSheet } from 'react-native'

export const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.35)'
  },
  dialog: {
    flexDirection: 'column',
    borderRadius: 14,
    borderWidth: 1,
    paddingTop: 14,
    paddingBottom: 10,
    paddingHorizontal: 10
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingBottom: 8
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600'
  },
  sectionWrap: {
    paddingHorizontal: 8
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
    paddingTop: 2,
    paddingBottom: 6
  },
  effortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    paddingBottom: 4
  },
  effortChip: {
    paddingHorizontal: 10,
    height: 26,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  effortChipLabel: {
    fontSize: 12
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 6,
    marginHorizontal: 4
  },
  modelListScroll: {
    flexGrow: 0,
    maxHeight: 280
  },
  modelListContent: {
    paddingHorizontal: 4,
    paddingBottom: 4
  },
  emptyWrap: {
    paddingVertical: 20,
    alignItems: 'center'
  },
  emptyText: {
    fontSize: 12
  },
  providerGroup: {
    marginBottom: 8
  },
  providerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 6,
    paddingVertical: 4
  },
  providerName: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600'
  },
  countBadge: {
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1
  },
  countText: {
    fontSize: 11,
    fontWeight: '500'
  },
  modelRow: {
    height: 34,
    paddingHorizontal: 8,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6
  },
  modelInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  modelName: {
    fontSize: 13,
    flexShrink: 1
  },
  footer: {
    paddingTop: 10,
    paddingHorizontal: 4,
    gap: 8
  },
  saveBtn: {
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5
  },
  manageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 4
  },
  manageBtnText: {
    fontSize: 12,
    fontWeight: '500'
  }
})
