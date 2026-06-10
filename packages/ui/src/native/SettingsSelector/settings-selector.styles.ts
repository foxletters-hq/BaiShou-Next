import { StyleSheet } from 'react-native'

export const settingsSelectorStyles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8
  },
  triggerValue: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20
  },
  chevron: {
    fontSize: 20,
    fontWeight: '300'
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject
  },
  modalPanel: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    maxHeight: '70%'
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14
  },
  modalCancel: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14
  }
})
