import { StyleSheet } from 'react-native'
import { mobileTypography, sharedTokens } from '@baishou/ui/theme/tokens'

export const aiProviderConfigFormStyles = StyleSheet.create({
  configCard: {
    padding: sharedTokens.spacing.md,
    gap: sharedTokens.spacing.sm
  },
  configHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  configTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.smPlus,
    flex: 1
  },
  configTitle: {
    fontSize: mobileTypography.title.fontSize,
    fontWeight: '600',
    flexShrink: 1
  },
  systemBadge: {
    fontSize: mobileTypography.caption.fontSize,
    marginBottom: sharedTokens.spacing.xs
  },
  fieldLabel: {
    fontSize: mobileTypography.caption.fontSize,
    marginTop: sharedTokens.spacing.xs
  },
  searchInput: {
    marginTop: sharedTokens.spacing.sm
  },
  actionRow: {
    flexDirection: 'row',
    gap: sharedTokens.spacing.sm,
    marginTop: sharedTokens.spacing.xs
  },
  actionBtn: {
    flex: 1,
    paddingVertical: sharedTokens.spacing.mdTight,
    borderRadius: sharedTokens.radius.control,
    alignItems: 'center'
  },
  actionBtnText: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '600'
  },
  emptyModelsContainer: {
    paddingVertical: sharedTokens.spacing.md,
    alignItems: 'center',
    justifyContent: 'center'
  },
  emptyModelsText: {
    fontSize: mobileTypography.secondary.fontSize,
    textAlign: 'center'
  },
  noEnabledBanner: {
    marginTop: sharedTokens.spacing.xs,
    padding: sharedTokens.spacing.smPlus,
    borderRadius: sharedTokens.radius.control,
    borderWidth: StyleSheet.hairlineWidth,
    gap: sharedTokens.spacing.xs,
    alignItems: 'center'
  },
  noEnabledBannerText: {
    fontSize: mobileTypography.secondary.fontSize,
    textAlign: 'center'
  },
  modelList: {
    marginTop: sharedTokens.spacing.xs
  },
  modelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: sharedTokens.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: sharedTokens.spacing.sm
  },
  modelRowLeading: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  modelRowTitle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0
  },
  modelRowText: {
    flexShrink: 1,
    fontSize: mobileTypography.secondary.fontSize
  },
  loadMoreModelsBtn: {
    marginTop: sharedTokens.spacing.smPlus,
    paddingVertical: sharedTokens.spacing.smPlus,
    borderRadius: sharedTokens.radius.control,
    alignItems: 'center'
  },
  loadMoreModelsText: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '600'
  },
  modelCountHint: {
    marginTop: sharedTokens.spacing.smPlus,
    textAlign: 'center',
    fontSize: mobileTypography.caption.fontSize
  },
  deleteLink: {
    marginTop: sharedTokens.spacing.mdTight,
    alignItems: 'center'
  }
})
