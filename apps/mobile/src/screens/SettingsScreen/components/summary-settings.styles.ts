import { StyleSheet } from 'react-native'
import { mobileTypography, sharedTokens } from '@baishou/ui/theme/tokens'

export const summarySettingsStyles = StyleSheet.create({
  cardTitle: {
    fontSize: mobileTypography.body.fontSize,
    fontWeight: '600',
    marginBottom: sharedTokens.spacing.sm,
    lineHeight: 22
  },
  subsectionTitle: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '600',
    marginBottom: sharedTokens.spacing.sm,
    lineHeight: 20
  },
  desc: {
    fontSize: mobileTypography.secondary.fontSize,
    lineHeight: 19,
    marginBottom: sharedTokens.spacing.mdTight
  },
  fieldLabel: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '600',
    marginBottom: sharedTokens.spacing.sm,
    lineHeight: 20
  },
  systemPromptBlock: { marginTop: sharedTokens.spacing.mdSnug },
  assistantBlock: { marginTop: sharedTokens.spacing.mdSnug },
  partnerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.mdTight,
    paddingVertical: sharedTokens.spacing.mdTight,
    paddingHorizontal: sharedTokens.spacing.mdSnug,
    borderRadius: sharedTokens.radius.control,
    borderWidth: 1
  },
  partnerAvatar: {
    width: 36,
    height: 36,
    borderRadius: sharedTokens.radius.lg,
    alignItems: 'center',
    justifyContent: 'center'
  },
  partnerAvatarImage: {
    width: 36,
    height: 36,
    borderRadius: sharedTokens.radius.lg
  },
  partnerAvatarSmall: {
    width: 28,
    height: 28,
    borderRadius: sharedTokens.radius.md,
    alignItems: 'center',
    justifyContent: 'center'
  },
  partnerAvatarImageSmall: {
    width: 28,
    height: 28,
    borderRadius: sharedTokens.radius.md
  },
  partnerName: { fontWeight: '600', fontSize: mobileTypography.secondary.fontSize, lineHeight: 20 },
  injectRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: sharedTokens.spacing.mdTight,
    marginTop: sharedTokens.spacing.md
  },
  injectText: { flex: 1 },
  lookbackBlock: { marginTop: sharedTokens.spacing.mdSnug, gap: sharedTokens.spacing.smPlus },
  lookbackLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: sharedTokens.spacing.mdTight
  },
  dataSourceLine: {
    fontSize: mobileTypography.secondary.fontSize,
    lineHeight: 20,
    marginBottom: sharedTokens.spacing.xs
  },
  localeHint: {
    fontSize: mobileTypography.secondary.fontSize,
    marginBottom: sharedTokens.spacing.smPlus,
    lineHeight: 18
  },
  langBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: sharedTokens.spacing.sm,
    marginBottom: sharedTokens.spacing.mdSnug
  },
  langChip: {
    paddingHorizontal: sharedTokens.spacing.mdTight,
    paddingVertical: sharedTokens.spacing.sm,
    borderRadius: sharedTokens.radius.lgPlus,
    borderWidth: 1
  },
  langChipGeneration: {
    borderStyle: 'dashed'
  },
  actions: {
    flexDirection: 'row',
    gap: sharedTokens.spacing.smPlus,
    marginBottom: sharedTokens.spacing.lg
  },
  btn: {
    flex: 1,
    paddingVertical: sharedTokens.spacing.mdTight,
    borderRadius: sharedTokens.radius.control,
    borderWidth: 1,
    alignItems: 'center'
  },
  saveBtn: { borderWidth: 0 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: sharedTokens.spacing.lg
  },
  modalSheet: {
    borderRadius: sharedTokens.radius.md,
    padding: sharedTokens.spacing.md,
    maxHeight: '70%'
  },
  partnerPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.smPlus,
    paddingVertical: sharedTokens.spacing.mdTight,
    paddingHorizontal: sharedTokens.spacing.mdTight,
    borderRadius: sharedTokens.radius.sm,
    marginBottom: sharedTokens.spacing.xs
  }
})
