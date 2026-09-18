import { StyleSheet } from 'react-native'

export const incrementalSyncConfirmStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16
  },
  dialogWrap: {
    width: '100%',
    alignItems: 'center',
    zIndex: 2
  },
  dialog: {
    width: '100%',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    flexDirection: 'column'
  },
  headerBlock: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 10,
    gap: 10
  },
  title: {
    fontSize: 17,
    fontWeight: '600'
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 20
  },
  trafficSummary: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 20
  },
  cellularWarning: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(245, 158, 11, 0.1)'
  },
  warningItem: {
    fontSize: 12,
    lineHeight: 18,
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(245, 158, 11, 0.1)'
  },
  scrollBody: {
    flex: 1,
    minHeight: 0
  },
  scrollContent: {
    paddingHorizontal: 18,
    gap: 10,
    paddingBottom: 8
  },
  vaultSection: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    padding: 10,
    gap: 6
  },
  vaultHeader: {
    gap: 4
  },
  vaultTitleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6
  },
  vaultName: {
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
    flexGrow: 1
  },
  vaultTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  badgeActive: {
    fontSize: 11,
    fontWeight: '600'
  },
  badgeUnregistered: {
    fontSize: 11,
    fontWeight: '600'
  },
  vaultStats: {
    fontSize: 11,
    alignSelf: 'flex-end'
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8
  },
  actionTag: {
    fontSize: 10,
    fontWeight: '600',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden'
  },
  filePath: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16
  },
  moreHint: {
    fontSize: 11
  },
  countdownHint: {
    fontSize: 11,
    textAlign: 'right'
  },
  choicePanel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    padding: 10,
    gap: 6
  },
  choiceTitle: {
    fontSize: 14,
    fontWeight: '600'
  },
  choiceDesc: {
    fontSize: 12,
    lineHeight: 18
  },
  choiceMeta: {
    fontSize: 11
  },
  deleteChoiceFooter: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8
  },
  fullWidthButton: {
    width: '100%',
    alignSelf: 'stretch'
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 18,
    borderTopWidth: StyleSheet.hairlineWidth
  },
  actionButton: {
    flex: 1
  }
})
