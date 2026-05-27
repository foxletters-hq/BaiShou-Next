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
    padding: 20
  },
  modalContent: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 16,
    overflow: 'hidden'
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
  pickerContainer: {
    flexDirection: 'row',
    height: 300
  },
  yearPane: {
    width: 100,
    borderRightWidth: 1
  },
  yearList: {
    flex: 1
  },
  yearItem: {
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8
  },
  yearText: {
    fontSize: 15
  },
  monthPane: {
    flex: 1,
    padding: 8
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8
  },
  monthItem: {
    width: '30%',
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1
  },
  monthText: {
    fontSize: 14,
    fontWeight: '600'
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
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center'
  },
  footerBtnText: {
    fontSize: 14,
    fontWeight: '600'
  }
})
