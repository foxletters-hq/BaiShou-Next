import { StyleSheet } from 'react-native'

export const pageSizeSelectorStyles = StyleSheet.create({
  wrapper: {
    position: 'relative'
  },
  triggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 32,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1
  },
  pageSizeValue: {
    fontSize: 13,
    fontWeight: '600'
  },
  pageSizeUnit: {
    fontSize: 13,
    fontWeight: '400'
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24
  },
  dropdownPanel: {
    width: '100%',
    maxWidth: 200,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4
  },
  optionBtn: {
    width: '31%',
    minWidth: 44,
    flexGrow: 1,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  optionBtnText: {
    fontSize: 14,
    fontWeight: '500'
  },
  optionBtnTextSelected: {
    fontWeight: '600'
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 6
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 2
  },
  footerText: {
    fontSize: 11,
    fontWeight: '500'
  }
})
