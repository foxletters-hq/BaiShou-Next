import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import {
  STREAMING_GRADIENT_TAIL_CHARS,
  STREAMING_INITIAL_STOCKPILE_CHARS,
  STREAMING_REVEAL_TICK_MS,
  completeStreamingMarkdownSlice,
  computeStreamingRevealStep,
  snapStreamingRevealIndex
} from './agent-markdown-stream.util'

export interface AgentStreamingRevealResult {
  displayContent: string
  streamingTailFadeChars: number
}

interface RevealProgressState {
  revealedLen: number
  solidLen: number
}

const activeRevealInstances = new Set<symbol>()
const activeRevealStopHandlers = new Map<symbol, () => void>()
const activeRevealListeners = new Set<() => void>()

function notifyActiveRevealListeners(): void {
  for (const listener of activeRevealListeners) {
    listener()
  }
}

function setRevealInstanceActive(id: symbol, active: boolean): void {
  const has = activeRevealInstances.has(id)
  if (active && !has) {
    activeRevealInstances.add(id)
    notifyActiveRevealListeners()
  } else if (!active && has) {
    activeRevealInstances.delete(id)
    notifyActiveRevealListeners()
  }
}

/** 当前是否存在尚未揭示或尚未完全渐显的 AgentMarkdown 实例 */
export function isAnyAgentMarkdownRevealing(): boolean {
  return activeRevealInstances.size > 0
}

/** 用户点击取消/停止时，立即终止所有进行中的渐显缓冲并落定当前文本 */
export function stopAllAgentMarkdownRevealing(): void {
  const handlers = Array.from(activeRevealStopHandlers.values())
  const hadActive = activeRevealInstances.size > 0
  activeRevealInstances.clear()
  for (const stop of handlers) {
    stop()
  }
  if (hadActive) {
    notifyActiveRevealListeners()
  }
}

/** 订阅当前是否有 AgentMarkdown 仍在渐显输出中（供滚动跟随与底部操作栏延迟展示使用） */
export function useIsAgentMarkdownRevealing(): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      activeRevealListeners.add(onStoreChange)
      return () => {
        activeRevealListeners.delete(onStoreChange)
      }
    },
    () => activeRevealInstances.size > 0,
    () => false
  )
}

function stepRevealProgress(
  prev: RevealProgressState,
  targetText: string,
  isStreaming: boolean
): RevealProgressState {
  const targetLen = targetText.length
  if (targetLen === 0) {
    if (prev.revealedLen === 0 && prev.solidLen === 0) return prev
    return { revealedLen: 0, solidLen: 0 }
  }

  const clampedRevealed = Math.min(prev.revealedLen, targetLen)
  const clampedSolid = Math.min(prev.solidLen, clampedRevealed)
  const backlog = targetLen - clampedRevealed

  let nextRevealed = clampedRevealed
  let step = 0
  if (backlog > 0) {
    step = computeStreamingRevealStep(backlog, isStreaming)
    nextRevealed = snapStreamingRevealIndex(targetText, clampedRevealed + step, clampedRevealed)
  }

  const minSolidFloor = Math.max(0, nextRevealed - STREAMING_GRADIENT_TAIL_CHARS)
  const fadeAdvance = backlog > 0 ? Math.max(5, Math.floor(Math.max(step, 6) * 0.85)) : 10
  const nextSolid = Math.min(nextRevealed, Math.max(minSolidFloor, clampedSolid + fadeAdvance))

  if (nextRevealed === prev.revealedLen && nextSolid === prev.solidLen) {
    return prev
  }

  return {
    revealedLen: nextRevealed,
    solidLen: nextSolid
  }
}

/**
 * 移动端伙伴流式输出“先囤积、再分批渐显”控制 Hook（对齐桌面端 XMarkdown 体验）：
 * - 先在缓冲池中囤积词句，按 100ms 节拍每次释放一个自然词句分片（6~22 字）
 * - 将 Markdown 重解析与排版频率降至 10Hz，把 90% 的主线程时间留给叶节点渐显动画与 60fps 滚动
 * - 配合 legacy-markdown-streaming-tail 中的 StreamingAnimatedText，每个新词句分片独立执行 320ms 缓出淡入
 */
export function useAgentStreamingReveal(
  content: string,
  isStreaming: boolean
): AgentStreamingRevealResult {
  const instanceIdRef = useRef<symbol | null>(null)
  if (!instanceIdRef.current) {
    instanceIdRef.current = Symbol('agent-markdown-reveal')
  }

  const wasStreamingRef = useRef(isStreaming)
  const stoppedByUserRef = useRef(false)
  const prevContentLenRef = useRef(content.length)
  if (content.length < prevContentLenRef.current || (!isStreaming && !wasStreamingRef.current)) {
    if (!isStreaming) {
      stoppedByUserRef.current = false
    }
  }
  prevContentLenRef.current = content.length

  if (isStreaming && !stoppedByUserRef.current) {
    wasStreamingRef.current = true
  }

  const contentRef = useRef(content)
  contentRef.current = content
  const isStreamingRef = useRef(isStreaming)
  isStreamingRef.current = isStreaming && !stoppedByUserRef.current

  const [progress, setProgress] = useState<RevealProgressState>(() => {
    if (!isStreaming) {
      return { revealedLen: content.length, solidLen: content.length }
    }
    if (content.length < STREAMING_INITIAL_STOCKPILE_CHARS) {
      return { revealedLen: 0, solidLen: 0 }
    }
    const firstStep = computeStreamingRevealStep(content.length, true)
    const initialRevealed = snapStreamingRevealIndex(content, firstStep, 0)
    return {
      revealedLen: initialRevealed,
      solidLen: Math.max(0, initialRevealed - STREAMING_GRADIENT_TAIL_CHARS)
    }
  })

  const hasPendingReveal =
    wasStreamingRef.current &&
    (progress.revealedLen < content.length || progress.solidLen < progress.revealedLen)

  if (!isStreaming && !hasPendingReveal && wasStreamingRef.current) {
    wasStreamingRef.current = false
  }

  useEffect(() => {
    const id = instanceIdRef.current!
    activeRevealStopHandlers.set(id, () => {
      stoppedByUserRef.current = true
      wasStreamingRef.current = false
      isStreamingRef.current = false
      const len = contentRef.current.length
      setProgress((prev) =>
        prev.revealedLen === len && prev.solidLen === len
          ? prev
          : { revealedLen: len, solidLen: len }
      )
    })
    return () => {
      activeRevealStopHandlers.delete(id)
    }
  }, [])

  useEffect(() => {
    const id = instanceIdRef.current!
    setRevealInstanceActive(id, hasPendingReveal)
    return () => {
      setRevealInstanceActive(id, false)
    }
  }, [hasPendingReveal])

  useEffect(() => {
    if (!wasStreamingRef.current && !isStreaming) {
      setProgress((prev) => {
        if (prev.revealedLen === content.length && prev.solidLen === content.length) return prev
        return { revealedLen: content.length, solidLen: content.length }
      })
      return
    }

    if (!content) {
      setProgress((prev) =>
        prev.revealedLen === 0 && prev.solidLen === 0 ? prev : { revealedLen: 0, solidLen: 0 }
      )
      return
    }

    setProgress((prev) => {
      if (prev.revealedLen > content.length) {
        return { revealedLen: content.length, solidLen: content.length }
      }
      // 当首包囤积已满（>= 12 字）或流已结束时立即释放首段词句
      if (
        prev.revealedLen === 0 &&
        (content.length >= STREAMING_INITIAL_STOCKPILE_CHARS || !isStreaming)
      ) {
        return stepRevealProgress(prev, content, isStreaming)
      }
      return prev
    })
  }, [content, isStreaming])

  useEffect(() => {
    if (!hasPendingReveal) {
      return
    }

    const timer = setInterval(() => {
      setProgress((prev) => {
        const next = stepRevealProgress(prev, contentRef.current, isStreamingRef.current)
        if (
          !isStreamingRef.current &&
          next.revealedLen >= contentRef.current.length &&
          next.solidLen >= next.revealedLen
        ) {
          wasStreamingRef.current = false
        }
        return next
      })
    }, STREAMING_REVEAL_TICK_MS)

    return () => clearInterval(timer)
  }, [hasPendingReveal])

  if (!wasStreamingRef.current && !isStreaming) {
    return {
      displayContent: content,
      streamingTailFadeChars: 0
    }
  }

  const clampedRevealed = Math.min(progress.revealedLen, content.length)
  const clampedSolid = Math.min(progress.solidLen, clampedRevealed)
  const isPartial = clampedRevealed < content.length
  const rawSlice = isPartial ? content.slice(0, clampedRevealed) : content
  const displayContent = completeStreamingMarkdownSlice(rawSlice, isPartial)
  const streamingTailFadeChars = Math.max(0, clampedRevealed - clampedSolid)

  return {
    displayContent,
    streamingTailFadeChars
  }
}
