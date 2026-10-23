import { Dimensions, Platform, StyleSheet } from 'react-native'
import { BRAND_BLUE_DARK } from './onboarding-theme'
import { mobileTypography, sharedTokens } from '@baishou/ui/theme/tokens'

export const SCREEN_WIDTH = Dimensions.get('window').width

export const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent'
  },
  scrollView: {
    flex: 1
  },
  page: {
    width: SCREEN_WIDTH,
    flex: 1
  },
  pageScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: sharedTokens.spacing.xl,
    paddingVertical: sharedTokens.spacing.md,
    maxWidth: 480,
    alignSelf: 'center',
    width: '100%'
  },
  slideInner: {
    alignItems: 'center'
  },
  slideTitle: {
    fontSize: mobileTypography.display.fontSize,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: -0.3,
    lineHeight: 30
  },
  slideBody: {
    fontSize: mobileTypography.primary.fontSize,
    lineHeight: 27,
    textAlign: 'center'
  },
  welcomeIconWrap: {
    width: 140,
    height: 140,
    borderRadius: 32,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#9AD4EA',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.25,
        shadowRadius: 30
      },
      default: {}
    })
  },
  welcomeIcon: {
    width: 140,
    height: 140,
    borderRadius: 32
  },
  welcomeTitle: {
    marginTop: sharedTokens.spacing.xlPlus,
    fontSize: mobileTypography.display.fontSize,
    fontWeight: '600',
    letterSpacing: -0.5,
    textAlign: 'center',
    color: BRAND_BLUE_DARK
  },
  welcomeTagline: {
    marginTop: sharedTokens.spacing.xsPlus,
    fontSize: mobileTypography.primary.fontSize,
    fontWeight: '600',
    textAlign: 'center',
    color: BRAND_BLUE_DARK,
    opacity: 0.85
  },
  slideSpacerLarge: {
    height: 36
  },
  slideSpacerMedium: {
    height: 20
  },
  sloganSpacer: {
    height: 40
  },
  slogan: {
    fontSize: mobileTypography.body.fontSize,
    letterSpacing: 2,
    textAlign: 'center'
  },
  bottomControls: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: sharedTokens.spacing.mdPlus,
    paddingTop: sharedTokens.spacing.mdTight,
    paddingBottom: sharedTokens.spacing.lg
  },
  indicators: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.xs,
    flexShrink: 0
  },
  indicator: {
    height: 7,
    borderRadius: sharedTokens.radius.xs
  },
  navActions: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: sharedTokens.spacing.xs
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: sharedTokens.spacing.mdTight,
    paddingVertical: sharedTokens.spacing.sm
  },
  backText: {
    fontSize: mobileTypography.secondary.fontSize,
    marginLeft: sharedTokens.spacing.xxs
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.xs,
    paddingHorizontal: sharedTokens.spacing.lg,
    paddingVertical: sharedTokens.spacing.mdTight,
    borderRadius: sharedTokens.radius.md
  },
  nextButtonText: {
    fontSize: mobileTypography.body.fontSize,
    fontWeight: '600'
  }
})
