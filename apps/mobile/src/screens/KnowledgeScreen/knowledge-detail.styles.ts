import { StyleSheet } from 'react-native'
import { mobileTypography, sharedTokens } from '@baishou/ui/theme/tokens'

export const knowledgeDetailStyles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  coverRow: { flexDirection: 'row', alignItems: 'center' },
  coverImage: { width: '100%', height: '100%' },
  sourceRow: { flexDirection: 'row', alignItems: 'center' },
  sourceStatus: { flexDirection: 'row', alignItems: 'center' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap' },
  rowGap: { flexDirection: 'row', flexWrap: 'wrap' },
  batchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  batchSelectAll: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    minWidth: 0
  },
  batchActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0
  },
  checkRow: { flexDirection: 'row', alignItems: 'center' },
  coverActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap'
  },
  submitActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap'
  },
  statusStrip: {
    flexDirection: 'column'
  },
  statusPair: {
    flexDirection: 'row',
    width: '100%'
  },
  statusItem: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center'
  },
  chooserGrid: {
    flexDirection: 'row',
    alignItems: 'stretch'
  },
  chooserItem: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0
  },
  chooserTile: {
    width: '100%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  extractHintActions: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    justifyContent: 'flex-end',
    alignItems: 'center'
  },
  importProcessRow: {
    flexDirection: 'column'
  },
  importProcessMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  statusMeta: {
    flex: 1,
    minWidth: 0
  },
  settingsGroup: {
    flexDirection: 'column'
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  settingsCard: {
    overflow: 'hidden'
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  settingsRowText: {
    flex: 1,
    minWidth: 0
  },
  settingsDivider: {
    height: StyleSheet.hairlineWidth
  },
  forceRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  emptyCanvas: {
    flex: 1
  },
  searchToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.sm
  },
  organizeFab: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
  organizeFabLabel: {
    fontSize: mobileTypography.primary.fontSize,
    fontWeight: mobileTypography.primary.fontWeight
  },
  importField: {
    width: '100%',
    alignSelf: 'stretch'
  },
  importBodyInput: {
    minHeight: sharedTokens.spacing.xxxl * 3 + sharedTokens.spacing.xl,
    maxHeight: sharedTokens.spacing.xxxl * 3 + sharedTokens.spacing.xl
  },
  sourceSquare: {
    width: '100%',
    aspectRatio: 1,
    minHeight: 0,
    overflow: 'hidden'
  },
  sourceSquareBody: {
    flex: 1,
    minHeight: 0,
    justifyContent: 'center'
  },
  sourceSquareMenu: {
    position: 'absolute',
    top: sharedTokens.spacing.md,
    right: sharedTokens.spacing.md,
    zIndex: 1
  },
  sourceSquareMenuBtn: {
    width: sharedTokens.spacing.xl,
    height: sharedTokens.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center'
  },
  organizeTaskCard: {
    padding: sharedTokens.spacing.sm,
    borderRadius: sharedTokens.radius.md,
    gap: sharedTokens.spacing.xs,
    marginBottom: sharedTokens.spacing.sm
  },
  organizePhaseRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  organizePhaseLabel: {
    width: sharedTokens.spacing.xxxl,
    flexShrink: 0
  },
  organizePhaseTrack: {
    height: sharedTokens.spacing.xs,
    borderRadius: sharedTokens.radius.xs,
    overflow: 'hidden'
  },
  organizePhaseBar: {
    flex: 1
  },
  organizePhaseValue: {
    minWidth: sharedTokens.spacing.xxxl,
    textAlign: 'right',
    flexShrink: 0
  }
})
