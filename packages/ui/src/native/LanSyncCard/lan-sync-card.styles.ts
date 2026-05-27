import { StyleSheet } from 'react-native'

export const lanSyncCardStyles = StyleSheet.create({
  container: {
    padding: 16,
    borderWidth: 1
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8
  },
  statusText: {
    fontSize: 15,
    fontWeight: '500'
  },
  toggleButton: {
    paddingVertical: 8,
    paddingHorizontal: 20
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600'
  },
  qrSection: {
    padding: 14,
    borderWidth: 1,
    marginBottom: 16,
    alignItems: 'center'
  },
  qrLabel: {
    fontSize: 12,
    marginBottom: 6
  },
  qrText: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'monospace'
  },
  devicesSection: {
    marginTop: 4
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 16
  },
  deviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    marginBottom: 8,
    flexWrap: 'wrap'
  },
  deviceInfo: {
    flex: 1,
    marginRight: 8
  },
  deviceName: {
    fontSize: 14,
    fontWeight: '500'
  },
  deviceDetail: {
    fontSize: 12,
    marginTop: 2
  },
  sendButton: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },
  sendButtonText: {
    fontSize: 13,
    fontWeight: '600'
  },
  progressMini: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    width: '100%'
  },
  progressMiniBar: {
    flex: 1,
    height: 4,
    marginRight: 8,
    overflow: 'hidden'
  },
  progressMiniFill: {
    height: 4
  },
  progressMiniText: {
    fontSize: 11,
    width: 36,
    textAlign: 'right'
  }
})
