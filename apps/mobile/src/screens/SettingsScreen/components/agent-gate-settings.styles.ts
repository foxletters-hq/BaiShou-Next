import { StyleSheet } from 'react-native'
import { mobileTypography, sharedTokens } from '@baishou/ui/theme/tokens'

export const agentGateSettingsStyles = StyleSheet.create({
  cardTitle: {
    fontSize: mobileTypography.body.fontSize,
    fontWeight: '600',
    marginBottom: sharedTokens.spacing.sm
  },
  desc: {
    fontSize: mobileTypography.secondary.fontSize,
    lineHeight: 20,
    marginBottom: sharedTokens.spacing.mdTight
  },
  divider: {
    height: 1,
    marginVertical: sharedTokens.spacing.mdSnug
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.mdTight
  },
  rowText: {
    flex: 1,
    gap: sharedTokens.spacing.xs
  },
  label: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '600'
  },
  hint: {
    fontSize: mobileTypography.caption.fontSize,
    lineHeight: 18
  },
  empty: {
    fontSize: mobileTypography.secondary.fontSize,
    lineHeight: 20,
    paddingVertical: sharedTokens.spacing.xs
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: sharedTokens.spacing.smPlus,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  listText: {
    flex: 1,
    gap: sharedTokens.spacing.xxs,
    paddingRight: sharedTokens.spacing.mdTight
  },
  listPrimary: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '600'
  },
  listMeta: {
    fontSize: mobileTypography.caption.fontSize
  },
  removeText: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '600'
  },
  addText: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '600'
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.mdTight,
    marginTop: sharedTokens.spacing.sm
  },
  effectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: sharedTokens.spacing.sm,
    marginTop: sharedTokens.spacing.smPlus
  },
  effectChip: {
    paddingHorizontal: sharedTokens.spacing.mdTight,
    paddingVertical: sharedTokens.spacing.sm,
    borderRadius: sharedTokens.radius.control,
    borderWidth: StyleSheet.hairlineWidth
  },
  profileBlock: {
    marginBottom: sharedTokens.spacing.mdTight,
    gap: sharedTokens.spacing.xs
  },
  profileTitle: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '600',
    marginBottom: sharedTokens.spacing.xxs
  },
  profileRule: {
    fontSize: mobileTypography.caption.fontSize,
    lineHeight: 18
  }
})
