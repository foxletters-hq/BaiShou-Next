export interface ToolExecution {
  name: string
  durationMs: number
}

export interface NativeStreamingBubbleProps {
  text: string
  reasoning?: string
  isReasoning?: boolean
  activeToolName?: string | null
  completedTools?: ToolExecution[]
  aiProfile?: {
    name: string
    avatarPath?: string | null
    emoji?: string | null
  }
  error?: string | null
  onRetry?: () => void
}
