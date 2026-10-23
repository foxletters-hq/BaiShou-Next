import { StyleSheet } from 'react-native'
import { iconSizes, mobileTypography, sharedTokens } from '../../theme/tokens'

export const galleryPanelStyles = StyleSheet.create({
  container: {},
  row: {
    gap: sharedTokens.spacing.xs,
    marginBottom: sharedTokens.spacing.xs
  },
  imageWrapper: {
    borderRadius: sharedTokens.radius.sm,
    borderWidth: 1,
    overflow: 'hidden'
  },
  image: {
    width: '100%',
    height: '100%'
  },
  captionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: sharedTokens.spacing.xsPlus,
    paddingVertical: sharedTokens.spacing.xxs
  },
  captionText: {
    fontSize: mobileTypography.caption.fontSize
  },
  empty: {
    borderRadius: sharedTokens.radius.md,
    borderWidth: 1,
    padding: sharedTokens.spacing.xl,
    alignItems: 'center'
  },
  emptyIcon: {
    fontSize: iconSizes.xl,
    marginBottom: sharedTokens.spacing.sm
  },
  emptyText: {
    fontSize: mobileTypography.body.fontSize
  },
  fullscreenOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  fullscreenImage: {
    width: '95%',
    height: '80%'
  },
  closeBtn: {
    position: 'absolute',
    top: 40,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: sharedTokens.radius.lgPlus,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1
  },
  closeBtnText: {
    fontSize: mobileTypography.display.fontSize,
    fontWeight: '300'
  },
  summaryContainer: {
    flex: 1
  },
  tabsContainer: {
    marginBottom: sharedTokens.spacing.mdTight
  },
  tabsContent: {
    paddingHorizontal: sharedTokens.spacing.md,
    gap: sharedTokens.spacing.sm
  },
  tabButton: {
    paddingHorizontal: sharedTokens.spacing.md,
    paddingVertical: sharedTokens.spacing.sm,
    borderRadius: sharedTokens.radius.lgPlus,
    borderWidth: 1
  },
  tabText: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '600'
  },
  yearContainer: {
    marginBottom: sharedTokens.spacing.md
  },
  yearContent: {
    paddingHorizontal: sharedTokens.spacing.md,
    gap: sharedTokens.spacing.sm
  },
  yearButton: {
    paddingHorizontal: sharedTokens.spacing.mdTight,
    paddingVertical: sharedTokens.spacing.xsPlus,
    borderRadius: sharedTokens.radius.lg,
    borderWidth: 1
  },
  yearText: {
    fontSize: mobileTypography.caption.fontSize,
    fontWeight: '500'
  },
  emptySummary: {
    alignItems: 'center',
    paddingVertical: sharedTokens.spacing.xlPlus,
    opacity: 0.5
  },
  summaryItem: {
    marginHorizontal: sharedTokens.spacing.md,
    marginBottom: sharedTokens.spacing.mdTight,
    padding: sharedTokens.spacing.md,
    borderRadius: sharedTokens.radius.md,
    borderWidth: 1
  },
  summaryItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: sharedTokens.spacing.sm
  },
  summaryItemTitle: {
    fontSize: mobileTypography.primary.fontSize,
    fontWeight: '600'
  },
  summaryItemDate: {
    fontSize: mobileTypography.caption.fontSize
  },
  summaryItemPreview: {
    fontSize: mobileTypography.secondary.fontSize,
    lineHeight: 20,
    marginBottom: sharedTokens.spacing.mdTight
  },
  summaryItemActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: sharedTokens.spacing.sm
  },
  actionButton: {
    paddingHorizontal: sharedTokens.spacing.mdTight,
    paddingVertical: sharedTokens.spacing.xsPlus,
    borderRadius: sharedTokens.radius.sm
  },
  actionText: {
    fontSize: mobileTypography.caption.fontSize,
    fontWeight: '600'
  }
})
