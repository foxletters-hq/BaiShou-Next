import { StyleSheet } from 'react-native'

export const yearMonthPickerStyles = StyleSheet.create({
  triggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 120
  },
  triggerText: {
    fontSize: 14,
    fontWeight: '600'
  },
  triggerArrow: {
    fontSize: 10,
    marginLeft: 8
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  modalContent: {
    borderRadius: 16,
    overflow: 'hidden',
    alignSelf: 'center',
    maxHeight: '85%'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700'
  },
  closeBtn: {
    fontSize: 18,
    fontWeight: '600',
    padding: 4
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    borderTopWidth: 1,
    gap: 12
  },
  footerBtn: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  footerBtnText: {
    fontSize: 13,
    fontWeight: '600'
  }
})
