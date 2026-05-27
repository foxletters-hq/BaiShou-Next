import { StyleSheet } from 'react-native'

export const galleryPanelStyles = StyleSheet.create({
  container: {},
  row: {
    gap: 4,
    marginBottom: 4
  },
  imageWrapper: {
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden'
  },
  image: {
    width: '100%',
    height: '100%'
  },
  captionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  captionText: {
    color: '#FFFFFF',
    fontSize: 11
  },
  empty: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 32,
    alignItems: 'center'
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 8
  },
  emptyText: {
    fontSize: 15
  },
  fullscreenOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  fullscreenImage: {
    width: '95%',
    height: '80%'
  },
  closeBtn: {
    position: 'absolute',
    top: 40,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1
  },
  closeBtnText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '300'
  },
  summaryContainer: {
    flex: 1
  },
  tabsContainer: {
    marginBottom: 12
  },
  tabsContent: {
    paddingHorizontal: 16,
    gap: 8
  },
  tabButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600'
  },
  yearContainer: {
    marginBottom: 16
  },
  yearContent: {
    paddingHorizontal: 16,
    gap: 8
  },
  yearButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1
  },
  yearText: {
    fontSize: 12,
    fontWeight: '500'
  },
  emptySummary: {
    alignItems: 'center',
    paddingVertical: 40,
    opacity: 0.5
  },
  summaryItem: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1
  },
  summaryItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  summaryItemTitle: {
    fontSize: 16,
    fontWeight: '700'
  },
  summaryItemDate: {
    fontSize: 12
  },
  summaryItemPreview: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12
  },
  summaryItemActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600'
  }
})
