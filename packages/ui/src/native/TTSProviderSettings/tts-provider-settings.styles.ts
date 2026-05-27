import { StyleSheet } from 'react-native'

export const ttsProviderSettingsStyles = StyleSheet.create({
  scroll: { flex: 1 },
  fieldGroup: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14
  },
  inputFlex: { flex: 1 },
  multilineInput: {
    minHeight: 72,
    textAlignVertical: 'top'
  },
  apiKeyRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center'
  },
  toggleBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  toggleBtnText: { fontSize: 14 },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1
  },
  chipText: { fontSize: 13, fontWeight: '500' },
  slider: { width: '100%', height: 40 },
  rangeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -4
  },
  rangeLabel: { fontSize: 11 },
  resultText: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '500'
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    marginTop: 8
  },
  actionBtn: { flex: 1 },
  bottomSpacer: { height: 40 }
})
