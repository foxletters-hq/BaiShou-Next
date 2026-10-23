import { StyleSheet } from 'react-native'
import { mobileTypography, sharedTokens } from '@baishou/ui/theme/tokens'

export const CORE_SIZE = 48

export const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  ring: {
    position: 'absolute',
    borderWidth: 1
  },
  reticleLineH: {
    position: 'absolute',
    height: StyleSheet.hairlineWidth
  },
  reticleLineV: {
    position: 'absolute',
    width: StyleSheet.hairlineWidth
  },
  reticleTick: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2
  },
  rippleWave: {
    position: 'absolute',
    borderWidth: 1.5
  },
  coreWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5
  },
  pulseCore: {
    width: CORE_SIZE,
    height: CORE_SIZE,
    borderRadius: CORE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center'
  },
  bubbleWrap: {
    position: 'absolute',
    zIndex: 10
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.smPlus,
    paddingVertical: sharedTokens.spacing.sm,
    paddingLeft: sharedTokens.spacing.smPlus,
    paddingRight: sharedTokens.spacing.mdTight,
    borderRadius: sharedTokens.radius.full,
    borderWidth: 1.2,
    minWidth: 130,
    maxWidth: 200
  },
  bubbleSending: {
    shadowOpacity: 0.22
  },
  bubbleIconContainer: {
    position: 'relative'
  },
  bubbleIcon: {
    width: 36,
    height: 36,
    borderRadius: sharedTokens.radius.lg,
    alignItems: 'center',
    justifyContent: 'center'
  },
  statusDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 1.5
  },
  bubbleInfo: {
    flex: 1,
    minWidth: 0
  },
  bubbleName: {
    fontSize: mobileTypography.primary.fontSize,
    fontWeight: '600'
  },
  bubbleIp: {
    fontSize: mobileTypography.caption.fontSize,
    marginTop: sharedTokens.spacing.xxs,
    fontFamily: 'monospace'
  },
  sendingBadge: {
    paddingHorizontal: sharedTokens.spacing.xsPlus,
    paddingVertical: sharedTokens.spacing.xxs,
    borderRadius: sharedTokens.radius.full
  },
  sendingText: {
    fontSize: mobileTypography.caption.fontSize,
    fontWeight: '600'
  },
  statusCardWrap: {
    position: 'absolute',
    left: sharedTokens.spacing.lg,
    right: sharedTokens.spacing.lg,
    alignItems: 'center',
    zIndex: 20
  },
  statusCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: sharedTokens.radius.lgPlus,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: sharedTokens.spacing.mdSnug,
    paddingVertical: sharedTokens.spacing.smPlus
  },
  statusHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.smPlus
  },
  statusIconBox: {
    width: 34,
    height: 34,
    borderRadius: sharedTokens.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  statusTextWrap: {
    flex: 1,
    minWidth: 0
  },
  statusTitle: {
    fontSize: mobileTypography.primary.fontSize,
    fontWeight: '600',
    marginBottom: sharedTokens.spacing.xxs
  },
  statusSubtitle: {
    fontSize: mobileTypography.secondary.fontSize,
    lineHeight: 18
  },
  localIpRow: {
    marginTop: sharedTokens.spacing.sm,
    paddingTop: sharedTokens.spacing.xsPlus,
    borderTopWidth: StyleSheet.hairlineWidth,
    alignItems: 'center'
  },
  localIpLabel: {
    fontSize: mobileTypography.caption.fontSize
  },
  localIpValue: {
    fontFamily: 'monospace',
    fontWeight: '500'
  }
})
