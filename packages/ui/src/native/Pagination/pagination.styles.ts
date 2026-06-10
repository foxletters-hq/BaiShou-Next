import { StyleSheet } from 'react-native'

export const paginationStyles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4
  },
  pageBtn: {
    minWidth: 32,
    height: 32,
    paddingHorizontal: 6,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  pageBtnActive: {
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3
  },
  pageBtnText: {
    fontSize: 13,
    fontWeight: '500'
  },
  pageBtnTextActive: {
    fontWeight: '600'
  },
  ellipsis: {
    minWidth: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center'
  },
  ellipsisText: {
    fontSize: 14,
    letterSpacing: 2
  },
  jumper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 4,
    gap: 4,
    flexShrink: 0
  },
  jumperInput: {
    width: 40,
    height: 32,
    paddingHorizontal: 4,
    paddingVertical: 0,
    textAlign: 'center',
    fontSize: 13,
    borderWidth: 1,
    borderRadius: 8
  },
  jumperSuffix: {
    fontSize: 13
  }
})
