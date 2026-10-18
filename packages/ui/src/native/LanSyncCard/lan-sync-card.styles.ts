import { StyleSheet } from 'react-native'
import { mobileTypography, sharedTokens } from '../../theme/tokens'

export const lanSyncCardStyles = StyleSheet.create({
  container: {
    padding: sharedTokens.spacing.md,
    borderWidth: 1
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: sharedTokens.spacing.md
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: sharedTokens.radius.xs,
    marginRight: sharedTokens.spacing.sm
  },
  statusText: {
    fontSize: mobileTypography.body.fontSize,
    fontWeight: '500'
  },
  toggleButton: {
    paddingVertical: sharedTokens.spacing.sm,
    paddingHorizontal: sharedTokens.spacing.mdPlus
  },
  toggleText: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '600'
  },
  qrSection: {
    padding: sharedTokens.spacing.mdSnug,
    borderWidth: 1,
    marginBottom: sharedTokens.spacing.md,
    alignItems: 'center'
  },
  qrLabel: {
    fontSize: mobileTypography.caption.fontSize,
    marginBottom: sharedTokens.spacing.xsPlus
  },
  qrText: {
    fontSize: mobileTypography.primary.fontSize,
    fontWeight: '600',
    fontFamily: 'monospace'
  },
  devicesSection: {
    marginTop: sharedTokens.spacing.xs
  },
  sectionTitle: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '600',
    marginBottom: sharedTokens.spacing.smPlus
  },
  emptyText: {
    fontSize: mobileTypography.secondary.fontSize,
    textAlign: 'center',
    paddingVertical: sharedTokens.spacing.md
  },
  deviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: sharedTokens.spacing.mdTight,
    borderWidth: 1,
    marginBottom: sharedTokens.spacing.sm,
    flexWrap: 'wrap'
  },
  deviceInfo: {
    flex: 1,
    marginRight: sharedTokens.spacing.sm
  },
  deviceName: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '500'
  },
  deviceDetail: {
    fontSize: mobileTypography.caption.fontSize,
    marginTop: sharedTokens.spacing.xxs
  },
  sendButton: {
    paddingVertical: sharedTokens.spacing.xsPlus,
    paddingHorizontal: sharedTokens.spacing.mdSnug,
    alignItems: 'center',
    justifyContent: 'center'
  },
  sendButtonText: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '600'
  },
  progressMini: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: sharedTokens.spacing.sm,
    width: '100%'
  },
  progressMiniBar: {
    flex: 1,
    height: 4,
    marginRight: sharedTokens.spacing.sm,
    overflow: 'hidden'
  },
  progressMiniFill: {
    height: 4
  },
  progressMiniText: {
    fontSize: mobileTypography.caption.fontSize,
    width: 36,
    textAlign: 'right'
  }
})
