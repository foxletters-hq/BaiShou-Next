import { StyleSheet } from 'react-native'

export const agentScreenStyles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  backgroundImage: { flex: 1 },
  backgroundImageInner: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover'
  },
  loadMore: {
    marginHorizontal: 16,
    marginBottom: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 10
  },
  loadMoreText: {
    fontSize: 13,
    fontWeight: '600'
  },
  list: { flex: 1 },
  /** 有消息时不用 flexGrow，避免流式 Footer 移除后 offset 被钳到 0 */
  listContent: { paddingTop: 24, paddingBottom: 0, paddingHorizontal: 0 },
  bubble: { marginBottom: 6 },
  toolStatusContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 12,
    gap: 6
  },
  toolItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  toolCheckmark: {
    fontSize: 14,
    fontWeight: '600'
  },
  toolSpinner: {
    fontSize: 14,
    fontWeight: '600'
  },
  toolName: {
    fontSize: 13,
    fontWeight: '500'
  },
  toolNameActive: {
    fontSize: 13,
    fontWeight: '600'
  },
  empty: {
    height: 280,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24
  },
  emptyIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
    textAlign: 'center'
  },
  emptySub: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 20,
    opacity: 0.7
  },
  scrollBtnWrap: {
    position: 'absolute',
    right: 24
  },
  scrollBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4
  },
  inputDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    overflow: 'visible',
    zIndex: 10
  },
  emojiOnlyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    gap: 8
  },
  emojiOnlyAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
    flexShrink: 0
  },
  emojiOnlyAvatarImg: {
    width: 28,
    height: 28,
    borderRadius: 14
  },
  emojiOnlyAvatarFallback: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.08)'
  },
  emojiOnlyAvatarText: {
    fontSize: 14
  },
  emojiOnlyImages: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    flexShrink: 1
  },
  emojiOnlyImg: {
    width: 120,
    height: 120,
    borderRadius: 8
  }
})
