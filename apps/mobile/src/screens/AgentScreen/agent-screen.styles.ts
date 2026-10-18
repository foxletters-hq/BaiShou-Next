import { StyleSheet } from 'react-native'
import { mobileTypography, sharedTokens } from '@baishou/ui/theme/tokens'

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
    marginHorizontal: sharedTokens.spacing.md,
    marginBottom: sharedTokens.spacing.mdTight,
    paddingVertical: sharedTokens.spacing.smPlus,
    paddingHorizontal: sharedTokens.spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: sharedTokens.radius.control
  },
  loadMoreText: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '600'
  },
  list: { flex: 1 },
  /** 有消息时不用 flexGrow，避免流式 Footer 移除后 offset 被钳到 0 */
  listContent: { paddingTop: sharedTokens.spacing.lg, paddingBottom: 0, paddingHorizontal: 0 },
  bubble: { marginBottom: sharedTokens.spacing.xsPlus },
  toolStatusContainer: {
    paddingHorizontal: sharedTokens.spacing.md,
    paddingVertical: sharedTokens.spacing.smPlus,
    borderRadius: sharedTokens.radius.control,
    marginBottom: sharedTokens.spacing.mdTight,
    gap: sharedTokens.spacing.xsPlus
  },
  toolItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.sm
  },
  toolCheckmark: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '600'
  },
  toolSpinner: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '600'
  },
  toolName: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '500'
  },
  toolNameActive: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '600'
  },
  empty: {
    height: 280,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: sharedTokens.spacing.lg
  },
  emptyAvatar: {
    marginBottom: sharedTokens.spacing.mdTight
  },
  emptyGreeting: {
    alignItems: 'center',
    gap: sharedTokens.spacing.sm,
    marginBottom: sharedTokens.spacing.smPlus
  },
  emptyText: {
    fontSize: mobileTypography.title.fontSize,
    fontWeight: '600',
    textAlign: 'center'
  },
  emptySub: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 20,
    opacity: 0.7
  },
  scrollBtnWrap: {
    position: 'absolute',
    right: sharedTokens.spacing.lg,
    zIndex: 15
  },
  scrollBtn: {
    width: 40,
    height: 40,
    borderRadius: sharedTokens.radius.lgPlus,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1
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
    paddingHorizontal: sharedTokens.spacing.mdTight,
    paddingVertical: sharedTokens.spacing.xs,
    gap: sharedTokens.spacing.sm
  },
  emojiOnlyAvatar: {
    width: 28,
    height: 28,
    borderRadius: sharedTokens.radius.md,
    overflow: 'hidden',
    flexShrink: 0
  },
  emojiOnlyAvatarImg: {
    width: 28,
    height: 28,
    borderRadius: sharedTokens.radius.md
  },
  emojiOnlyAvatarFallback: {
    width: 28,
    height: 28,
    borderRadius: sharedTokens.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.08)'
  },
  emojiOnlyAvatarText: {
    fontSize: mobileTypography.secondary.fontSize
  },
  emojiOnlyImages: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: sharedTokens.spacing.xs,
    flexShrink: 1
  },
  emojiOnlyImg: {
    width: 120,
    height: 120,
    borderRadius: sharedTokens.radius.sm
  }
})
