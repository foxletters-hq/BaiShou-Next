import { Platform, StyleSheet } from 'react-native'
import { INPUT_CARD_BOTTOM_ROW, INPUT_MIN_HEIGHT } from './input-bar-height.util'

export const nativeInputBarStyles = StyleSheet.create({
  container: {
    // 分割线与底栏背景放在 composerChrome，避免快捷面板撑开时整条顶边被抬起
  },
  composerBlock: {
    position: 'relative',
    overflow: 'visible',
    zIndex: 20
  },
  composerChromeAnchor: {
    position: 'relative',
    zIndex: 1
  },
  composerChrome: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
    paddingHorizontal: 14,
    paddingBottom: 10
  },
  composerShell: {
    borderWidth: 1,
    borderRadius: 18,
    overflow: 'hidden'
  },
  toolbarAttached: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingTop: 6,
    paddingBottom: 4
  },
  toolbarContent: {
    gap: 8,
    paddingHorizontal: 4,
    alignItems: 'center'
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1
  },
  chipIcon: {
    fontSize: 13
  },
  chipLabel: {
    fontSize: 12,
    fontWeight: '500',
    maxWidth: 120
  },
  toolbarToggle: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center'
  },
  inputCard: {
    borderWidth: 0,
    borderRadius: 0,
    paddingTop: 6,
    paddingHorizontal: 10,
    paddingBottom: 6
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start'
  },
  topRowSingleLine: {
    alignItems: 'center'
  },
  inputWrapper: {
    flex: 1,
    minWidth: 0
  },
  expandToggle: {
    width: 28,
    height: 28,
    marginLeft: 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  expandToggleMultiline: {
    marginTop: 4
  },
  input: {
    minHeight: INPUT_MIN_HEIGHT,
    fontSize: 15,
    lineHeight: 20,
    paddingLeft: 4,
    paddingRight: 4,
    paddingTop: Platform.OS === 'ios' ? 8 : 6,
    paddingBottom: Platform.OS === 'ios' ? 8 : 6,
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null)
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 0,
    height: INPUT_CARD_BOTTOM_ROW,
    flexShrink: 0
  },
  sendBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center'
  },
  sendIcon: {
    fontSize: 18,
    fontWeight: '600'
  },
  stopBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center'
  },
  stopIcon: {
    width: 8,
    height: 8,
    borderRadius: 2
  },
  attachmentList: {
    flexDirection: 'row',
    marginBottom: 10,
    maxHeight: 64
  },
  attachmentChip: {
    marginRight: 8,
    borderRadius: 8,
    borderWidth: 1,
    width: 64,
    height: 64,
    overflow: 'hidden',
    position: 'relative'
  },
  attImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover'
  },
  attDoc: {
    flex: 1,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center'
  },
  attDocIcon: {
    fontSize: 20,
    marginBottom: 2
  },
  attDocName: {
    fontSize: 9,
    textAlign: 'center'
  },
  attRemoveBtn: {
    position: 'absolute',
    top: 2,
    right: 2,
    borderRadius: 8,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center'
  },
  attRemoveLabel: {
    fontSize: 10,
    fontWeight: '600'
  }
})
