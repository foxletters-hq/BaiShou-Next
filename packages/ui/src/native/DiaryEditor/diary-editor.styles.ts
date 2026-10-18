import { StyleSheet } from 'react-native'
import { mobileTypography, sharedTokens } from '../../theme/tokens'

export const diaryEditorStyles = StyleSheet.create({
  container: { flex: 1 },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: sharedTokens.spacing.mdTight,
    paddingTop: sharedTokens.spacing.sm,
    paddingBottom: sharedTokens.spacing.mdTight,
    borderBottomWidth: 1
  },
  iconBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  appBarCenter: { flex: 1, alignItems: 'center', minWidth: 0 },
  saveBtn: {
    paddingHorizontal: sharedTokens.spacing.md,
    paddingVertical: sharedTokens.spacing.sm,
    borderRadius: sharedTokens.radius.lgPlus
  },
  saveBtnText: { fontWeight: '600', fontSize: mobileTypography.secondary.fontSize },
  metaBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: sharedTokens.spacing.mdTight,
    paddingHorizontal: sharedTokens.spacing.md,
    paddingVertical: sharedTokens.spacing.smPlus,
    borderBottomWidth: 1
  },
  metaPickers: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.sm,
    flex: 1,
    flexWrap: 'wrap'
  },
  favBtn: {
    width: 40,
    height: 40,
    borderRadius: sharedTokens.radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  ttsBtn: {
    width: 40,
    height: 40,
    borderRadius: sharedTokens.radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  editorBody: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden'
  },
  editorPane: {
    flex: 1,
    paddingHorizontal: sharedTokens.spacing.md,
    paddingTop: sharedTokens.spacing.sm,
    paddingBottom: sharedTokens.spacing.sm
  },
  editorFill: {
    flex: 1
  },
  toolbarDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 10
  },
  editorLoadFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: sharedTokens.spacing.mdTight,
    paddingVertical: sharedTokens.spacing.xxl
  },
  editorLoadHint: {
    fontSize: mobileTypography.secondary.fontSize,
    textAlign: 'center',
    paddingHorizontal: sharedTokens.spacing.lg
  }
})
