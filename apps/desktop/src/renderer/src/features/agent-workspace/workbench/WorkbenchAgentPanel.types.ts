import type { ReactNode } from 'react'
import type {
  AgentGateFileChangePreview,
  AgentGateRequest,
  AgentWorkspaceEntry,
  AgentWorkspaceSessionListItem,
  PromptFileRef,
  WorkspaceChangeEntry
} from '@baishou/shared'
import type { AgentGateReplyPayload } from '@baishou/ui'
import type { WorkspaceBubbleActions } from '../components/workspace-bubble-actions.types'

export interface WorkbenchAgentPanelProps {
  width: number
  workspace: AgentWorkspaceEntry | null
  hasWorkspace: boolean
  hasConfiguredModel: boolean
  sessionId?: string
  sessions: AgentWorkspaceSessionListItem[]
  loadingSessions?: boolean
  onSelectChange: (change: WorkspaceChangeEntry) => void
  onReviewAll?: (changes: WorkspaceChangeEntry[]) => void
  sessionsViewActive?: boolean
  onToggleSessionsView?: () => void
  onNewSession: () => void
  onSelectSession: (sessionId: string) => void
  onDeleteSession: (sessionId: string) => void
  onRenameSession?: (sessionId: string, title: string) => void
  recentFilePaths?: string[]
  onOpenFile?: (relativePath: string, options?: { line?: number; isDirectory?: boolean }) => void
  chrome: {
    currentAssistant?: { id: string; name: string; avatarPath?: string | null }
    currentProviderId: string
    currentModelId: string
    providers: Array<{
      id: string
      name?: string
      type?: string
      models?: string[]
      enabledModels?: string[]
    }>
    totalInputTokens: number
    totalOutputTokens: number
    totalCacheReadInputTokens: number
    totalCacheWriteInputTokens: number
    estimatedCost: number
    onAssistantClick: () => void
    onModelClick: (anchorRect?: DOMRect | null) => void
    effortSuffix?: string | null
    pricingLastUpdated?: Date | null
    onRefreshPricing?: () => Promise<{ success: boolean; error?: string }>
  }
  chat: {
    messages: unknown[]
    pendingAssistantMsg: unknown
    hasMore?: boolean
    loadMore?: () => Promise<void>
  }
  stream: {
    text: string
    reasoning: string
    timeline?: import('@baishou/shared').AgentStreamTimelineItem[]
    isStreaming: boolean
    isBridgeActive?: boolean
    error: string | null
    activeToolName: string | null
    completedTools: unknown[]
    failedTools: unknown[]
    stopChat: () => void
  }
  assistantProfile?: { name: string; avatarPath?: string | null; emoji?: string | null }
  onSend: (
    text: string,
    attachments?: unknown[],
    searchMode?: boolean,
    meta?: {
      displayText?: string
      skillRefs?: Array<{ command: string; content: string }>
      fileRefs?: PromptFileRef[]
      delivery?: 'steer' | 'queue'
    }
  ) => boolean | void | Promise<boolean | void>
  onEditResend?: (
    userMessageId: string,
    newText: string,
    meta?: { skillRefs?: Array<{ command: string; content: string }>; fileRefs?: PromptFileRef[] }
  ) => boolean | Promise<boolean>
  bubbleActions?: WorkspaceBubbleActions
  onAssistantTap: () => void
  assistantName: string
  /** 回滚成功后回填输入框 */
  composerRefill?: {
    text: string
    skillRefs?: Array<{ command: string; content: string }>
    nonce: number
  } | null
  /** 输入区上方插槽（如 Agent Gate Dock） */
  gateSlot?: ReactNode
  /** 有待确认 Gate 时禁用 composer */
  gateBlocksComposer?: boolean
  pendingAsk?: AgentGateRequest | null
  isAskReplying?: boolean
  onAskReply?: (payload: AgentGateReplyPayload) => void | Promise<void>
  onOpenGateFileChange?: (preview: AgentGateFileChangePreview) => void
}

export interface WorkbenchAgentPanelHandle {
  addFileContext: (ref: PromptFileRef & { filePath?: string }) => void
}
