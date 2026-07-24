import { StyleSheet } from 'react-native'

export const assistantEditScreenStyles = StyleSheet.create({
  layoutContent: { flex: 1 },
  pageBody: {
    flex: 1
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  loadingText: {
    fontSize: 16
  },
  content: {
    flex: 1
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 16
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth
  },
  bottomBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16
  },
  bottomBtnFull: {
    flex: 1
  },
  bottomBtnOutline: {
    borderWidth: 1
  },
  bottomBtnPrimary: {},
  bottomBtnText: {
    fontSize: 16,
    fontWeight: '600'
  },
  avatarCard: {
    alignItems: 'stretch'
  },
  avatarSection: {
    alignItems: 'center'
  },
  avatarWrap: {
    width: 88,
    height: 88,
    position: 'relative'
  },
  avatarBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },
  textBtn: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 8
  },
  fieldGap: {
    height: 16
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8
  },
  rowSpacer: {
    flex: 1
  },
  outlinedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8
  },
  outlinedBtnText: {
    fontSize: 15,
    fontWeight: '500'
  },
  modelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8
  },
  modelInfo: {
    flex: 1,
    gap: 2
  },
  modelSup: {
    fontSize: 12
  },
  modelSub: {
    fontSize: 15,
    fontWeight: '600'
  },
  valueText: {
    fontSize: 14,
    fontWeight: '600'
  },
  sectionDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 16
  },
  resetLink: {
    fontSize: 13,
    fontWeight: '600'
  },
  compressPromptInput: {
    minHeight: 160,
    marginTop: 8
  }
})
