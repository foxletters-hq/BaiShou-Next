import { StyleSheet } from 'react-native'

export const ttsProviderSettingsStyles = StyleSheet.create({
  scroll: { flex: 1 },
  fieldGroup: {
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  fieldGroupDivider: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8
  },
  helperText: {
    fontSize: 12,
    marginBottom: 8,
    lineHeight: 18
  },
  input: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14
  },
  inputFlex: { flex: 1 },
  multilineInput: {
    minHeight: 72,
    textAlignVertical: 'top'
  },
  modelRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center'
  },
  modelInput: { flex: 1 },
  fetchModelsBtn: {
    paddingHorizontal: 14,
    minWidth: 72
  },
  visibilityToggle: {
    padding: 8
  },
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
  rangeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    marginHorizontal: -8
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
