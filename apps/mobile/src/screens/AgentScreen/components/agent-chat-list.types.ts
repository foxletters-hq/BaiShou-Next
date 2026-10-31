import type React from 'react'
import type { View, ScrollView, NativeScrollEvent, NativeSyntheticEvent } from 'react-native'
import type { MobileRuntimeQueueItem } from './MobileComposerRuntimeQueueBar'

export interface MobilePendingQueueController {
  pendingQueue: MobileRuntimeQueueItem[]
  editingInputId: string | null
  beginEdit: (item: MobileRuntimeQueueItem) => void
  cancelEdit: () => void
  commitEdit: (text: string) => Promise<boolean>
  deleteItem: (item: MobileRuntimeQueueItem) => Promise<void>
  sendNow: (item: MobileRuntimeQueueItem) => Promise<void>
}

export type ComposerOnSend = (
  text: string,
  attachments?: unknown[],
  searchMode?: boolean,
  meta?: {
    displayText?: string
    skillRefs?: Array<{ command: string; content: string }>
    fileRefs?: unknown[]
  }
) => boolean | Promise<boolean>

export type AgentChatListProps = {
  colors: any
  isDark: boolean
  t: (key: string, fallback?: string) => string
  resolvedChatBackgroundUri: string | null | undefined
  chatBackgroundBlur: number
  chatBackgroundOverlay: number
  userProfile: { chatBackgroundPath?: string | null }
  displayModelName: string | null
  currentProviderId: string | null
  currentModelId?: string | null
  currentProviderType: string | undefined
  dialogueProviders?: any[]
  handleSelectModel?: (providerId: string, modelId: string) => void
  totalCostMicros: number
  setDrawerOpen: (open: boolean) => void
  setShowModelSwitcher: (v: boolean) => void
  setShowCostDialog: (v: boolean) => void
  drawerSwipeEnabled: boolean
  flatListRef: React.RefObject<ScrollView | null>
  listContentStyle: any
  handleListScroll: (event: any) => void
  handleScrollBeginDrag: () => void
  handleScrollEndDrag: (event: NativeSyntheticEvent<NativeScrollEvent>) => void
  handleMomentumScrollBegin: () => void
  handleMomentumScrollEnd: (event: NativeSyntheticEvent<NativeScrollEvent>) => void
  handleListContentSizeChange: (width: number, height: number) => void
  handleListIntrinsicContentHeightChange: (height: number) => void
  listViewportHeight: number
  setListViewportHeight: React.Dispatch<React.SetStateAction<number>>
  layoutReadyRef: React.RefObject<boolean>
  messages: any[]
  pendingQueueCtl?: MobilePendingQueueController
  hasMore: boolean
  showLoadMoreBanner: boolean
  handleLoadMore: () => Promise<void> | void
  isStreaming: boolean
  isStreamBridgeActive: boolean
  renderEmptyState: (metaTone?: 'light' | 'dark' | boolean) => React.ReactNode
  chatRows: Array<{ kind: 'message'; item: any } | { kind: 'stream-tail' }>
  hasStreamingBody: boolean
  renderStreamingDots: (metaTone?: 'light' | 'dark' | boolean) => React.ReactNode
  streamingText: string
  streamingReasoning: string
  chatUserProfile: any
  chatAiProfile: any
  hasChatBackground: boolean
  liveStreamProps: any
  compressionPhase: string
  compressionTriggerMessageId: string | null | undefined
  isCompressing: boolean
  compressionText: string
  compressionReasoning: string
  IDLE_LIVE_COMPRESSION: any
  lastMessage: any
  streamError?: string | null
  liveAssistantActive: boolean
  keepLiveRowAfterHold: boolean
  markdownPresentationActive: boolean
  bubbleTextStreaming: boolean
  streamingThinkLoading: boolean
  activeToolDisplayName: string | null
  streamingCompletedTools: any[]
  editingMessageId: string | null
  editingRowRef: React.RefObject<View | null>
  handleRegenerate: (id: string) => void
  handleResend: (id: string) => Promise<void> | void
  handleEditMessage: (id: string, content: string) => void
  handleSaveAssistantEdit: (id: string, content: string) => void
  handleDeleteMessage: (id: string) => void
  handleTtsReadAloud: (content: string, id: string) => void
  ttsPlayingMsgId: string | null
  handleShowContext: (message: any) => void
  handleBranch: (id: string) => void
  handleBubbleEditingChange: (editing: boolean, messageId?: string) => void
  isRetryActionBusy: boolean
  listFooter: React.ReactNode
  showScrollButton: boolean
  isBubbleEditing: boolean
  scrollButtonAnimatedStyle: any
  scrollToBottom: (ref: React.RefObject<ScrollView | null>, animated: boolean) => void
  inputDockHeight: number
  setInputDockHeight: React.Dispatch<React.SetStateAction<number>>
  inputDockAnimatedStyle: any
  inputBarRef: React.RefObject<any>
  handleSendWithScroll: ComposerOnSend
  isLoading: boolean
  handleStop: () => void
  hasConfiguredDialogueModel: boolean
  toast: { showInfo: (msg: string) => void }
  composerDraftKey: string
  handleInputBarFocus: () => void
  shortcuts: any[]
  assistantDisplayName: string
  setShowShortcutSheet: (v: boolean) => void
  setShowRecallSheet: (v: boolean) => void
  router: { push: (href: '/settings/agent-tools') => void }
  searchMode: boolean
  toggleSearchMode: () => void
  ttsMode: 'manual' | 'always'
  toggleTtsMode: () => void
  currentSessionId?: string | null
  assistantId?: string | null
  assistantAvatarUri?: string | null
  assistantAvatarPath?: string | null
  assistantEmoji?: string | null
}
