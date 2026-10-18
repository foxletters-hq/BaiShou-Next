import { StyleSheet } from 'react-native'
import { mobileControlTokens, mobileTypography, sharedTokens } from '../../theme/tokens'

export const ttsProviderSettingsStyles = StyleSheet.create({
  scroll: { flex: 1 },
  fieldGroup: {
    paddingHorizontal: sharedTokens.spacing.md,
    paddingVertical: sharedTokens.spacing.mdTight
  },
  fieldGroupCard: {
    paddingVertical: 0
  },
  divider: {
    height: 1,
    marginVertical: sharedTokens.spacing.mdSnug
  },
  fieldGroupDivider: {
    paddingHorizontal: sharedTokens.spacing.md,
    paddingVertical: sharedTokens.spacing.mdTight,
    borderTopWidth: StyleSheet.hairlineWidth
  },
  cardSection: {
    borderRadius: sharedTokens.radius.md,
    overflow: 'visible'
  },
  label: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '500',
    marginBottom: sharedTokens.spacing.sm
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.xsPlus,
    marginBottom: sharedTokens.spacing.sm
  },
  labelInline: {
    marginBottom: 0
  },
  providerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: sharedTokens.spacing.sm
  },
  providerSelectWrap: {
    alignSelf: 'flex-end',
    flexShrink: 0
  },
  selectorTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: sharedTokens.radius.lg,
    paddingHorizontal: mobileControlTokens.inputPaddingHorizontal,
    paddingVertical: mobileControlTokens.inputPaddingVertical,
    minHeight: mobileControlTokens.height,
    gap: sharedTokens.spacing.sm,
    width: '100%'
  },
  selectorTriggerFlex: {
    flex: 1,
    width: undefined
  },
  sliderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: sharedTokens.spacing.sm
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: sharedTokens.spacing.sm
  },
  sliderValue: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '600'
  },
  fieldGroupRaised: {
    zIndex: 30
  },
  helperText: {
    fontSize: mobileTypography.caption.fontSize,
    marginBottom: sharedTokens.spacing.sm,
    lineHeight: 18
  },
  input: {
    paddingHorizontal: mobileControlTokens.inputPaddingHorizontal,
    paddingVertical: mobileControlTokens.inputPaddingVertical,
    minHeight: mobileControlTokens.height,
    fontSize: mobileTypography.secondary.fontSize
  },
  actionButton: {
    height: mobileControlTokens.height,
    minHeight: mobileControlTokens.height
  },
  inputFlex: { flex: 1 },
  multilineInput: {
    minHeight: 72,
    textAlignVertical: 'top'
  },
  modelRow: {
    flexDirection: 'row',
    gap: sharedTokens.spacing.sm,
    alignItems: 'center'
  },
  modelInput: { flex: 1 },
  fetchModelsBtn: {
    paddingHorizontal: sharedTokens.spacing.mdSnug,
    minWidth: 72,
    height: mobileControlTokens.height,
    minHeight: mobileControlTokens.height
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
    gap: sharedTokens.spacing.sm
  },
  chip: {
    paddingHorizontal: sharedTokens.spacing.mdSnug,
    paddingVertical: sharedTokens.spacing.sm,
    borderRadius: sharedTokens.radius.lgPlus,
    borderWidth: 1
  },
  chipText: { fontSize: mobileTypography.secondary.fontSize, fontWeight: '500' },
  rangeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: sharedTokens.spacing.xsPlus,
    marginHorizontal: -8
  },
  rangeLabel: { fontSize: mobileTypography.caption.fontSize },
  resultText: {
    marginTop: sharedTokens.spacing.sm,
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '500'
  },
  testRow: {
    flexDirection: 'row',
    gap: sharedTokens.spacing.sm,
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
    gap: sharedTokens.spacing.sm
  },
  refAudioPickButtonText: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '500'
  },
  selectedRefAudioName: {
    fontSize: mobileTypography.secondary.fontSize,
    lineHeight: 18,
    marginTop: sharedTokens.spacing.sm
  },
  saveActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: sharedTokens.spacing.md,
    marginTop: sharedTokens.spacing.md
  },
  saveActionsGroupCard: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: sharedTokens.spacing.md
  },
  groupCardDesc: {
    fontSize: mobileTypography.secondary.fontSize,
    lineHeight: 20,
    marginBottom: sharedTokens.spacing.md
  },
  bottomSpacer: { height: 40 },
  // ─── 对齐增量同步页面风格的选择框与操作控件 ───
  sectionTitle: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '600',
    marginBottom: sharedTokens.spacing.sm,
    textTransform: 'uppercase'
  },
  providerCardList: {
    marginTop: sharedTokens.spacing.xs,
    marginBottom: sharedTokens.spacing.xs
  },
  targetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: sharedTokens.spacing.mdSnug,
    borderRadius: sharedTokens.radius.md,
    borderWidth: 1.5,
    marginBottom: sharedTokens.spacing.smPlus,
    gap: sharedTokens.spacing.mdTight
  },
  targetIcon: {
    width: 44,
    height: 44,
    borderRadius: sharedTokens.radius.control,
    alignItems: 'center',
    justifyContent: 'center'
  },
  targetCardContent: {
    flex: 1,
    minWidth: 0
  },
  targetTitle: {
    fontSize: mobileTypography.body.fontSize,
    fontWeight: '600'
  },
  targetDesc: {
    fontSize: mobileTypography.caption.fontSize,
    marginTop: 2,
    lineHeight: 16
  },
  compactSelectTrigger: {
    minHeight: 32,
    paddingHorizontal: sharedTokens.spacing.smPlus,
    paddingVertical: sharedTokens.spacing.xxs,
    borderRadius: sharedTokens.radius.md
  },
  inlineFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    minHeight: 40,
    gap: sharedTokens.spacing.sm
  },
  modelInlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    minHeight: 40,
    gap: sharedTokens.spacing.sm
  },
  modelControlsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: sharedTokens.spacing.xsPlus,
    flex: 1,
    justifyContent: 'flex-end'
  },
  modelComboboxWrap: {
    minWidth: 120,
    maxWidth: 240,
    flex: 1
  },
  compactActionButton: {
    height: 32,
    minHeight: 32,
    maxHeight: 32,
    paddingHorizontal: sharedTokens.spacing.smPlus,
    paddingVertical: 0,
    borderRadius: sharedTokens.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  formatCardsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.smPlus
  },
  formatOptionCard: {
    flex: 1,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: sharedTokens.radius.md,
    borderWidth: 1.5,
    paddingHorizontal: sharedTokens.spacing.sm
  },
  formatOptionText: {
    fontSize: mobileTypography.secondary.fontSize,
    textAlign: 'center'
  },
  refAudioCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: sharedTokens.spacing.mdSnug,
    borderRadius: sharedTokens.radius.md,
    borderWidth: 1.5,
    gap: sharedTokens.spacing.mdTight,
    marginBottom: sharedTokens.spacing.xsPlus
  }
})
