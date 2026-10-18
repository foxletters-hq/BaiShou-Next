import { Platform, StyleSheet } from 'react-native'
import { NATIVE_SLIDER_HEIGHT } from '../Slider/native-slider.utils'
import { iconSizes, mobileTypography, uiTypography, sharedTokens } from '../../theme/tokens'

const GRADIENT_BAR_HEIGHT = 20

export const appearanceSettingsStyles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: sharedTokens.radius.lg,
    marginBottom: sharedTokens.spacing.md,
    marginHorizontal: sharedTokens.spacing.md,
    overflow: 'hidden'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: sharedTokens.spacing.md
  },
  icon: { fontSize: iconSizes.lg, marginRight: sharedTokens.spacing.md },
  headerBody: { flex: 1 },
  title: { fontSize: mobileTypography.primary.fontSize, fontWeight: '500' },
  subtitle: { fontSize: mobileTypography.secondary.fontSize, marginTop: sharedTokens.spacing.xs },
  arrow: { fontSize: uiTypography.sm },
  content: { paddingHorizontal: sharedTokens.spacing.md, paddingBottom: sharedTokens.spacing.md },
  label: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '500',
    marginBottom: sharedTokens.spacing.sm
  },
  colorPalette: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: sharedTokens.spacing.mdTight
  },
  colorOption: {
    width: 40,
    height: 40,
    borderRadius: sharedTokens.radius.lgPlus,
    justifyContent: 'center',
    alignItems: 'center'
  },
  checkIcon: { fontSize: iconSizes.md },
  divider: { height: 1, marginVertical: sharedTokens.spacing.md },
  langWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: sharedTokens.spacing.sm },
  langChip: {
    paddingHorizontal: sharedTokens.spacing.md,
    paddingVertical: sharedTokens.spacing.sm,
    borderRadius: sharedTokens.radius.lg,
    borderWidth: 1
  },
  langText: { fontSize: mobileTypography.secondary.fontSize },
  fontSizeBlock: { marginTop: 0 },
  fontSizeSliderWrap: {
    justifyContent: 'center',
    minHeight: NATIVE_SLIDER_HEIGHT,
    height: NATIVE_SLIDER_HEIGHT,
    marginTop: sharedTokens.spacing.xs
  },
  fontSizeTicks: {
    position: 'relative',
    height: 8,
    marginTop: sharedTokens.spacing.xxs,
    marginHorizontal: sharedTokens.spacing.sm
  },
  fontSizeTick: {
    position: 'absolute',
    top: 0,
    width: 1,
    height: 8,
    marginLeft: -0.5
  },
  fontSizeLabels: {
    position: 'relative',
    height: 22,
    marginTop: sharedTokens.spacing.sm,
    marginHorizontal: sharedTokens.spacing.sm
  },
  fontSizeLabel: {
    position: 'absolute',
    top: '50%'
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalBox: {
    width: '85%',
    borderRadius: sharedTokens.radius.xl,
    padding: sharedTokens.spacing.lg,
    alignItems: 'center'
  },
  modalTitle: {
    fontSize: mobileTypography.title.fontSize,
    fontWeight: '600',
    marginBottom: sharedTokens.spacing.mdPlus
  },
  colorPreview: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    marginBottom: sharedTokens.spacing.mdPlus,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 12
      },
      default: {}
    })
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: sharedTokens.spacing.mdTight
  },
  sliderLabel: {
    width: 40,
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '600'
  },
  sliderTrackWrap: {
    flex: 1,
    justifyContent: 'center',
    minHeight: NATIVE_SLIDER_HEIGHT,
    height: NATIVE_SLIDER_HEIGHT
  },
  gradientBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: (NATIVE_SLIDER_HEIGHT - GRADIENT_BAR_HEIGHT) / 2,
    height: GRADIENT_BAR_HEIGHT,
    flexDirection: 'row',
    borderRadius: sharedTokens.radius.control,
    overflow: 'hidden'
  },
  hueSegment: {
    flex: 1
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    width: '100%',
    marginTop: sharedTokens.spacing.lg,
    gap: sharedTokens.spacing.mdTight
  },
  modalBtn: {
    paddingHorizontal: sharedTokens.spacing.mdPlus,
    paddingVertical: sharedTokens.spacing.smPlus,
    borderRadius: sharedTokens.radius.lgPlus,
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalBtnTextGray: { fontWeight: '600' },
  modalBtnTextWhite: { fontWeight: '600' }
})
