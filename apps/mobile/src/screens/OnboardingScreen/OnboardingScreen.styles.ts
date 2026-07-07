import { Dimensions, StyleSheet } from 'react-native'
import { BRAND_BLUE_DARK } from './onboarding-theme'

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
    paddingHorizontal: 32,
    paddingVertical: 16,
    maxWidth: 480,
    alignSelf: 'center',
    width: '100%'
  },
  slideInner: {
    alignItems: 'center'
  },
  slideTitle: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.3,
    lineHeight: 30,
    color: '#111827'
  },
  slideBody: {
    fontSize: 16,
    lineHeight: 27,
    textAlign: 'center',
    color: '#6B7280'
  },
  welcomeIconWrap: {
    width: 140,
    height: 140,
    borderRadius: 32,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    shadowColor: '#9AD4EA',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 30,
    elevation: 8
  },
  welcomeIcon: {
    width: 140,
    height: 140,
    borderRadius: 32
  },
  welcomeTitle: {
    marginTop: 36,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    textAlign: 'center',
    color: BRAND_BLUE_DARK
  },
  welcomeTagline: {
    marginTop: 6,
    fontSize: 16,
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
    fontSize: 15,
    color: '#6B7280',
    letterSpacing: 2,
    textAlign: 'center'
  },
  bottomControls: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24
  },
  indicators: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 0
  },
  indicator: {
    height: 7,
    borderRadius: 4
  },
  navActions: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  backText: {
    fontSize: 13,
    color: '#6B7280',
    marginLeft: 2
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600'
  }
})
