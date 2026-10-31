import { StyleSheet } from 'react-native'
import { mobileTypography, sharedTokens } from '../../theme/tokens'

export const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject
  },
  dialog: {
    flexDirection: 'column',
    borderRadius: sharedTokens.radius.md,
    borderWidth: 1,
    paddingTop: sharedTokens.spacing.mdSnug,
    paddingBottom: sharedTokens.spacing.smPlus,
    paddingHorizontal: sharedTokens.spacing.smPlus
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: sharedTokens.spacing.sm,
    paddingBottom: sharedTokens.spacing.sm
  },
  headerTitle: {
    fontSize: mobileTypography.primary.fontSize,
    fontWeight: '600'
  },
  sectionWrap: {
    paddingHorizontal: sharedTokens.spacing.sm
  },
  sectionTitle: {
    fontSize: mobileTypography.caption.fontSize,
    fontWeight: '600',
    letterSpacing: 0.3,
    paddingTop: sharedTokens.spacing.xxs,
    paddingBottom: sharedTokens.spacing.xsPlus
  },
  effortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
    gap: sharedTokens.spacing.xs,
    paddingBottom: sharedTokens.spacing.xs
  },
  effortChip: {
    flex: 1,
    paddingHorizontal: sharedTokens.spacing.xs,
    height: 28,
    borderRadius: sharedTokens.radius.xsPlus,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  effortChipLabel: {
    fontSize: mobileTypography.caption.fontSize
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: sharedTokens.spacing.xsPlus,
    marginHorizontal: sharedTokens.spacing.xs
  },
  modelListScroll: {
    flexGrow: 0,
    maxHeight: 300
  },
  modelListContent: {
    paddingHorizontal: sharedTokens.spacing.xs,
    paddingBottom: sharedTokens.spacing.sm
  },
  emptyWrap: {
    paddingVertical: sharedTokens.spacing.mdPlus,
    alignItems: 'center'
  },
  emptyText: {
    fontSize: mobileTypography.caption.fontSize
  },
  providerGroup: {
    marginBottom: sharedTokens.spacing.sm
  },
  providerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.xsPlus,
    paddingHorizontal: sharedTokens.spacing.xsPlus,
    paddingVertical: sharedTokens.spacing.xs
  },
  providerName: {
    flex: 1,
    fontSize: mobileTypography.caption.fontSize,
    fontWeight: '600'
  },
  countBadge: {
    borderRadius: sharedTokens.radius.sm,
    paddingHorizontal: sharedTokens.spacing.xsPlus,
    paddingVertical: 1
  },
  countText: {
    fontSize: mobileTypography.caption.fontSize,
    fontWeight: '500'
  },
  modelRow: {
    height: 34,
    paddingLeft: sharedTokens.spacing.md,
    paddingRight: sharedTokens.spacing.sm,
    borderRadius: sharedTokens.radius.xsPlus,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: sharedTokens.spacing.xsPlus
  },
  modelInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.xsPlus
  },
  modelName: {
    fontSize: mobileTypography.secondary.fontSize,
    flexShrink: 1
  },
  footer: {
    marginTop: sharedTokens.spacing.xxs,
    paddingTop: sharedTokens.spacing.smPlus,
    paddingHorizontal: sharedTokens.spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: sharedTokens.spacing.sm
  },
  saveBtn: {
    height: 40,
    borderRadius: sharedTokens.radius.control,
    alignItems: 'center',
    justifyContent: 'center'
  },
  saveBtnText: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '600',
    letterSpacing: 0.5
  },
  manageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sharedTokens.spacing.xsPlus,
    paddingVertical: sharedTokens.spacing.xs
  },
  manageBtnText: {
    fontSize: mobileTypography.caption.fontSize,
    fontWeight: '500'
  }
})
