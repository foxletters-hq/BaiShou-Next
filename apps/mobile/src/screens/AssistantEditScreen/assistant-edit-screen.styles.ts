import { StyleSheet } from 'react-native'
import { mobileTypography, sharedTokens } from '@baishou/ui/theme/tokens'

export const assistantEditScreenStyles = StyleSheet.create({
  layoutContent: { flex: 1 },
  pageBody: {
    flex: 1
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  loadingText: {
    fontSize: mobileTypography.primary.fontSize
  },
  content: {
    flex: 1
  },
  contentContainer: {
    padding: sharedTokens.spacing.md,
    paddingBottom: sharedTokens.spacing.md
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: sharedTokens.spacing.mdTight,
    paddingHorizontal: sharedTokens.spacing.md,
    paddingTop: sharedTokens.spacing.mdTight,
    borderTopWidth: StyleSheet.hairlineWidth
  },
  bottomBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: sharedTokens.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: sharedTokens.spacing.md
  },
  bottomBtnFull: {
    flex: 1
  },
  bottomBtnOutline: {
    borderWidth: 1
  },
  bottomBtnPrimary: {},
  bottomBtnText: {
    fontSize: mobileTypography.primary.fontSize,
    fontWeight: '600'
  },
  avatarCard: {
    alignItems: 'stretch'
  },
  avatarSection: {
    alignItems: 'center'
  },
  avatarWrap: {
    width: 88,
    height: 88,
    position: 'relative'
  },
  avatarBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 28,
    height: 28,
    borderRadius: sharedTokens.radius.md,
    alignItems: 'center',
    justifyContent: 'center'
  },
  textBtn: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '500',
    marginTop: sharedTokens.spacing.sm
  },
  fieldGap: {
    height: 16
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.sm,
    marginBottom: sharedTokens.spacing.sm
  },
  rowSpacer: {
    flex: 1
  },
  outlinedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sharedTokens.spacing.sm,
    paddingVertical: sharedTokens.spacing.mdTight,
    paddingHorizontal: sharedTokens.spacing.md,
    borderRadius: sharedTokens.radius.md,
    borderWidth: 1,
    marginBottom: sharedTokens.spacing.sm
  },
  outlinedBtnText: {
    fontSize: mobileTypography.body.fontSize,
    fontWeight: '500'
  },
  modelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.mdTight,
    padding: sharedTokens.spacing.mdTight,
    borderRadius: sharedTokens.radius.md,
    borderWidth: 1,
    marginBottom: sharedTokens.spacing.sm
  },
  modelInfo: {
    flex: 1,
    gap: sharedTokens.spacing.xxs
  },
  modelSup: {
    fontSize: mobileTypography.caption.fontSize
  },
  modelSub: {
    fontSize: mobileTypography.body.fontSize,
    fontWeight: '600'
  },
  valueText: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '600'
  },
  sectionDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: sharedTokens.spacing.md
  },
  resetLink: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '600'
  },
  compressPromptInput: {
    minHeight: 160,
    marginTop: sharedTokens.spacing.sm
  }
})
