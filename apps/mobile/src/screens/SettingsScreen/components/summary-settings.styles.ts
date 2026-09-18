import { StyleSheet } from 'react-native'

export const summarySettingsStyles = StyleSheet.create({
  cardTitle: { fontSize: 15, fontWeight: '600', marginBottom: 8, lineHeight: 22 },
  subsectionTitle: { fontSize: 14, fontWeight: '600', marginBottom: 8, lineHeight: 20 },
  sourceGroup: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    borderRadius: 8,
    marginBottom: 4
  },
  sourceBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 6
  },
  desc: { fontSize: 13, lineHeight: 19, marginBottom: 12 },
  fieldLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8, lineHeight: 20 },
  systemPromptBlock: { marginTop: 14 },
  assistantBlock: { marginTop: 14 },
  partnerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1
  },
  partnerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center'
  },
  partnerAvatarImage: {
    width: 36,
    height: 36,
    borderRadius: 18
  },
  partnerAvatarSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },
  partnerAvatarImageSmall: {
    width: 28,
    height: 28,
    borderRadius: 14
  },
  partnerName: { fontWeight: '600', fontSize: 14, lineHeight: 20 },
  injectRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginTop: 18
  },
  injectText: { flex: 1 },
  lookbackBlock: { marginTop: 14, gap: 10 },
  lookbackLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12
  },
  dataSourceLine: { fontSize: 13, lineHeight: 20, marginBottom: 4 },
  localeHint: { fontSize: 13, marginBottom: 10, lineHeight: 18 },
  langBar: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  langChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1
  },
  langChipGeneration: {
    borderStyle: 'dashed'
  },
  tabBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    padding: 4,
    borderRadius: 8,
    marginBottom: 12
  },
  tabBtn: {
    flex: 1,
    minWidth: '22%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 8,
    borderRadius: 6
  },
  tabIcon: { fontSize: 16 },
  actions: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center'
  },
  saveBtn: { borderWidth: 0 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24
  },
  modalSheet: {
    borderRadius: 14,
    padding: 16,
    maxHeight: '70%'
  },
  partnerPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4
  }
})
