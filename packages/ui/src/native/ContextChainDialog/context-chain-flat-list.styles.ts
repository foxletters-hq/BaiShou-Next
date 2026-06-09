import { StyleSheet } from 'react-native'

export const contextChainFlatListStyles = StyleSheet.create({
  metaRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 4
  },
  metaChip: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1
  },
  compressionHint: {
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 6,
    paddingHorizontal: 4,
    fontWeight: '500'
  },
  roundHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 4,
    marginTop: 4
  },
  roundChevron: {
    fontSize: 12,
    width: 14,
    opacity: 0.7
  },
  roundLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2
  },
  roundMeta: {
    fontSize: 13,
    fontWeight: '500',
    opacity: 0.85
  },
  roundBody: {
    gap: 2,
    paddingBottom: 4
  },
  messageItem: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
    gap: 8
  },
  messageTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8
  },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6
  },
  roleBadgeText: {
    fontSize: 13,
    fontWeight: '600'
  },
  messagePreview: {
    fontSize: 14,
    lineHeight: 21
  }
})
