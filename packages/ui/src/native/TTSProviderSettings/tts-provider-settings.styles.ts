import { StyleSheet } from 'react-native'

export const ttsProviderSettingsStyles = StyleSheet.create({
  scroll: { flex: 1 },
  fieldGroup: {
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  fieldGroupCard: {
    paddingVertical: 0
  },
  divider: {
    height: 1,
    marginVertical: 14
  },
  fieldGroupDivider: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth
  },
  cardSection: {
    borderRadius: 12,
    overflow: 'visible'
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8
  },
  labelInline: {
    marginBottom: 0
  },
  sliderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  sliderValue: {
    fontSize: 13,
    fontWeight: '600'
  },
  fieldGroupRaised: {
    zIndex: 30
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
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center'
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
  testRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center'
  },
  testInputWrap: {
    flex: 1,
    minWidth: 0
  },
  testButtonWrap: {
    flexShrink: 0
  },
  refAudioPickButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8
  },
  refAudioPickButtonText: {
    fontSize: 14,
    fontWeight: '500'
  },
  selectedRefAudioName: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8
  },
  saveActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    marginTop: 16
  },
  saveActionsGroupCard: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16
  },
  groupCardDesc: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16
  },
  bottomSpacer: { height: 40 }
})
