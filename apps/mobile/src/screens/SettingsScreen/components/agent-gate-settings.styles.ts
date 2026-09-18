import { StyleSheet } from 'react-native'

export const agentGateSettingsStyles = StyleSheet.create({
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8
  },
  desc: {
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 12
  },
  divider: {
    height: 1,
    marginVertical: 14
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  rowText: {
    flex: 1,
    gap: 4
  },
  label: {
    fontSize: 14,
    fontWeight: '600'
  },
  hint: {
    fontSize: 12,
    lineHeight: 18
  },
  empty: {
    fontSize: 13,
    lineHeight: 20,
    paddingVertical: 4
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  listText: {
    flex: 1,
    gap: 2,
    paddingRight: 12
  },
  listPrimary: {
    fontSize: 14,
    fontWeight: '600'
  },
  listMeta: {
    fontSize: 11
  },
  removeText: {
    fontSize: 13,
    fontWeight: '600'
  },
  addText: {
    fontSize: 13,
    fontWeight: '600'
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8
  },
  effectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10
  },
  effectChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth
  },
  profileBlock: {
    marginBottom: 12,
    gap: 4
  },
  profileTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2
  },
  profileRule: {
    fontSize: 12,
    lineHeight: 18
  }
})
