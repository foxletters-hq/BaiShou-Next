import { StyleSheet } from 'react-native'
import { mobileTypography, sharedTokens } from '../../theme/tokens'

export const cloudSyncPanelStyles = StyleSheet.create({
  container: {
    padding: sharedTokens.spacing.md,
    borderWidth: 1
  },
  title: {
    fontSize: mobileTypography.primary.fontSize,
    fontWeight: '600',
    marginBottom: sharedTokens.spacing.md
  },
  targetRow: {
    flexDirection: 'row',
    marginBottom: sharedTokens.spacing.md,
    gap: sharedTokens.spacing.sm
  },
  targetChip: {
    flex: 1,
    paddingVertical: sharedTokens.spacing.smPlus,
    alignItems: 'center',
    borderWidth: 1
  },
  targetChipText: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '500'
  },
  configSection: {
    marginBottom: sharedTokens.spacing.sm
  },
  fieldGroup: {
    marginBottom: sharedTokens.spacing.mdTight
  },
  fieldLabel: {
    fontSize: mobileTypography.secondary.fontSize,
    marginBottom: sharedTokens.spacing.xs
  },
  fieldInput: {
    paddingVertical: sharedTokens.spacing.smPlus,
    paddingHorizontal: sharedTokens.spacing.mdTight,
    fontSize: mobileTypography.secondary.fontSize
  },
  hintText: {
    fontSize: mobileTypography.secondary.fontSize,
    textAlign: 'center',
    paddingVertical: sharedTokens.spacing.md
  },
  saveButton: {
    paddingVertical: sharedTokens.spacing.mdTight,
    alignItems: 'center',
    marginBottom: sharedTokens.spacing.mdTight
  },
  saveButtonText: {
    fontSize: mobileTypography.body.fontSize,
    fontWeight: '600'
  },
  syncButton: {
    flexDirection: 'row',
    paddingVertical: sharedTokens.spacing.mdTight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginBottom: sharedTokens.spacing.md
  },
  syncButtonText: {
    fontSize: mobileTypography.body.fontSize,
    fontWeight: '600'
  },
  recordsSection: {
    marginTop: sharedTokens.spacing.xs
  },
  sectionTitle: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '600',
    marginBottom: sharedTokens.spacing.smPlus
  },
  recordItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: sharedTokens.spacing.smPlus,
    borderBottomWidth: 1
  },
  recordInfo: {
    flex: 1
  },
  recordName: {
    fontSize: mobileTypography.secondary.fontSize
  },
  recordMeta: {
    fontSize: mobileTypography.caption.fontSize,
    marginTop: sharedTokens.spacing.xxs
  }
})
