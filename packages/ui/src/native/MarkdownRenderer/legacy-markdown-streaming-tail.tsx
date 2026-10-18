import React from 'react'
import { Platform, Text, View } from 'react-native'
import {
  STREAMING_CHUNK_FADE_DURATION_MS,
  applyAlphaToColor
} from '../AgentMarkdown/agent-markdown-stream.util'

export interface MarkdownAstNodeLike {
  key?: string
  type?: string
  index?: number
  content?: string
  markup?: string
  attributes?: { start?: number; href?: string }
  children?: MarkdownAstNodeLike[]
}

interface NodeTailFadeInfo {
  fadeStartInNode: number
  distFromTipAtEnd: number
}

const rootTailFadeCache = new WeakMap<
  object,
  { tailFadeChars: number; nodes: WeakMap<object, NodeTailFadeInfo> }
>()

/**
 * 为 react-native-markdown-display AST 节点生成稳定的位置 key，
 * 避免上游默认 `rnmr_${uuid++}` 导致流式每一帧卸载重建整棵组件树。
 */
export function getStableAstNodeKey(
  node: MarkdownAstNodeLike,
  parentNodes?: MarkdownAstNodeLike[]
): string {
  const type = node.type ?? 'node'
  const selfIdx = typeof node.index === 'number' ? node.index : 0
  if (!parentNodes || parentNodes.length <= 1) return `md_${selfIdx}_${type}`
  let path = 'md'
  for (let i = parentNodes.length - 2; i >= 0; i--) {
    const p = parentNodes[i]
    path += `_${typeof p?.index === 'number' ? p.index : 0}`
  }
  return `${path}_${selfIdx}_${type}`
}

function buildRootTailFadeMap(
  root: MarkdownAstNodeLike,
  tailFadeChars: number
): WeakMap<object, NodeTailFadeInfo> {
  const map = new WeakMap<object, NodeTailFadeInfo>()
  let remaining = tailFadeChars

  const walkReverse = (node: MarkdownAstNodeLike) => {
    if (remaining <= 0 || !node) return
    const children = node.children
    if (Array.isArray(children) && children.length > 0) {
      for (let i = children.length - 1; i >= 0; i--) {
        walkReverse(children[i]!)
        if (remaining <= 0) return
      }
    }
    if (
      (node.type === 'text' || node.type === 'code_inline') &&
      typeof node.content === 'string' &&
      node.content.length > 0
    ) {
      const len = node.content.length
      const take = Math.min(len, remaining)
      map.set(node, {
        fadeStartInNode: len - take,
        distFromTipAtEnd: tailFadeChars - remaining
      })
      remaining -= take
    }
  }

  walkReverse(root)
  return map
}

function getNodeTailFadeInfo(
  node: MarkdownAstNodeLike,
  parentNodes: MarkdownAstNodeLike[] | undefined,
  tailFadeChars: number
): NodeTailFadeInfo | null {
  if (tailFadeChars <= 0) return null
  const root = parentNodes && parentNodes.length > 0 ? parentNodes[parentNodes.length - 1] : node
  if (!root || typeof root !== 'object') return null

  let cached = rootTailFadeCache.get(root)
  if (!cached || cached.tailFadeChars !== tailFadeChars) {
    cached = { tailFadeChars, nodes: buildRootTailFadeMap(root, tailFadeChars) }
    rootTailFadeCache.set(root, cached)
  }
  return cached.nodes.get(node) ?? null
}

function trimTrailingNewline(content: string | undefined): string {
  if (!content) return ''
  return content.endsWith('\n') ? content.slice(0, -1) : content
}

const BULLET_CHAR = Platform.select({ android: '\u2022', ios: '\u00B7', default: '\u2022' })

function areChildrenIdentical(prev: readonly unknown[], next: unknown): boolean {
  if (!Array.isArray(next)) return prev.length === 1 && prev[0] === next
  if (prev.length !== next.length) return false
  for (let i = 0; i < prev.length; i++) {
    if (prev[i] !== next[i]) return false
  }
  return true
}

export interface StreamingElementMemoizer {
  memoizeContainer: (
    stableKey: string,
    children: React.ReactNode,
    styleRef: unknown,
    extraKey: unknown,
    factory: () => React.ReactElement
  ) => React.ReactElement
}

export function createStreamingElementMemoizer(): StreamingElementMemoizer {
  const containerCache = new Map<
    string,
    { children: unknown[]; styleRef: unknown; extraKey: unknown; element: React.ReactElement }
  >()

  return {
    memoizeContainer(stableKey, children, styleRef, extraKey, factory) {
      const hit = containerCache.get(stableKey)
      if (
        hit &&
        hit.styleRef === styleRef &&
        hit.extraKey === extraKey &&
        areChildrenIdentical(hit.children, children)
      ) {
        return hit.element
      }
      const element = factory()
      containerCache.set(stableKey, {
        children: Array.isArray(children) ? children.slice() : [children],
        styleRef,
        extraKey,
        element
      })
      return element
    }
  }
}

interface FadingTextChunk {
  id: number
  start: number
  end: number
  bornAt: number
}

/**
 * 对齐桌面端 @ant-design/x-markdown AnimationText 的叶节点独立渐显组件：
 * - 每次囤积释放的新词句作为一个固定区间 chunk 追加，拥有独立的 bornAt 时间戳
 * - 仅在该叶节点内部通过 requestAnimationFrame 推进 320ms Ease-Out 透明度过渡（0.06 -> 1.0）
 * - 动画期间无需重跑外层 Markdown 解析或触发段落重排，已完全显色的前缀自动合并回纯文本
 */
const StreamingAnimatedText = React.memo(function StreamingAnimatedText({
  content,
  fadeStartInNode,
  baseColor,
  textStyle
}: {
  content: string
  fadeStartInNode: number | null
  baseColor: string
  textStyle: unknown
}) {
  const chunksRef = React.useRef<FadingTextChunk[]>([])
  const trackedLenRef = React.useRef<number>(
    fadeStartInNode !== null ? fadeStartInNode : content.length
  )
  const nextChunkIdRef = React.useRef(1)
  const [, setTick] = React.useState(0)

  if (content.length < trackedLenRef.current) {
    chunksRef.current = []
    trackedLenRef.current = fadeStartInNode !== null ? fadeStartInNode : content.length
  }

  if (fadeStartInNode !== null && content.length > trackedLenRef.current) {
    const now = Date.now()
    const start = Math.max(0, Math.min(trackedLenRef.current, content.length))
    if (content.length > start) {
      const last = chunksRef.current[chunksRef.current.length - 1]
      if (last && now - last.bornAt < 28 && last.end === start) {
        last.end = content.length
      } else {
        chunksRef.current.push({
          id: nextChunkIdRef.current++,
          start,
          end: content.length,
          bornAt: now
        })
      }
    }
    trackedLenRef.current = content.length
  } else if (fadeStartInNode === null && chunksRef.current.length === 0) {
    trackedLenRef.current = content.length
  }

  const hasActiveChunks = chunksRef.current.length > 0

  React.useEffect(() => {
    if (!hasActiveChunks) return
    let rafId: number | null = null
    let lastTick = 0

    const step = () => {
      const now = Date.now()
      while (
        chunksRef.current.length > 0 &&
        now - chunksRef.current[0]!.bornAt >= STREAMING_CHUNK_FADE_DURATION_MS
      ) {
        chunksRef.current.shift()
      }
      if (chunksRef.current.length === 0) {
        setTick((t) => t + 1)
        return
      }
      if (now - lastTick >= 20) {
        lastTick = now
        setTick((t) => t + 1)
      }
      rafId = requestAnimationFrame(step)
    }

    rafId = requestAnimationFrame(step)
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId)
    }
  }, [hasActiveChunks, content.length])

  if (chunksRef.current.length === 0) {
    return <Text style={textStyle as object}>{content}</Text>
  }

  const now = Date.now()
  const firstChunkStart = Math.min(content.length, chunksRef.current[0]!.start)
  const solidPrefix = firstChunkStart > 0 ? content.slice(0, firstChunkStart) : ''

  return (
    <Text style={textStyle as object}>
      {solidPrefix}
      {chunksRef.current.map((chunk) => {
        const s = Math.min(content.length, chunk.start)
        const e = Math.min(content.length, chunk.end)
        if (e <= s) return null
        const elapsed = Math.max(0, now - chunk.bornAt)
        const progress = Math.min(1, elapsed / STREAMING_CHUNK_FADE_DURATION_MS)
        const eased = 1 - Math.pow(1 - progress, 2.2)
        const alpha = Number((0.06 + 0.94 * eased).toFixed(3))
        return (
          <Text key={chunk.id} style={{ color: applyAlphaToColor(baseColor, alpha) }}>
            {content.slice(s, e)}
          </Text>
        )
      })}
    </Text>
  )
})

export function buildStreamingMarkdownRules(options: {
  tailFadeCharsRef: { current: number }
  defaultTextColor: string
  memoizer?: StreamingElementMemoizer
  revision?: number
}) {
  const {
    tailFadeCharsRef,
    defaultTextColor,
    memoizer = createStreamingElementMemoizer()
  } = options

  const leafCache = new Map<
    string,
    { content: string; styleRef: unknown; inheritedColor: unknown; element: React.ReactElement }
  >()

  const getOrCreateLeaf = (
    stableKey: string,
    content: string,
    styleRef: unknown,
    inheritedColor: unknown,
    factory: () => React.ReactElement
  ) => {
    const hit = leafCache.get(stableKey)
    if (
      hit &&
      hit.content === content &&
      hit.styleRef === styleRef &&
      hit.inheritedColor === inheritedColor
    ) {
      return hit.element
    }
    const element = factory()
    leafCache.set(stableKey, { content, styleRef, inheritedColor, element })
    return element
  }

  const makeViewRule =
    (styleKey: string) =>
    (
      node: MarkdownAstNodeLike,
      children: React.ReactNode,
      parentNodes: MarkdownAstNodeLike[],
      styles: Record<string, object | undefined>
    ) => {
      const stableKey = getStableAstNodeKey(node, parentNodes)
      const styleObj = styles[styleKey]
      return memoizer.memoizeContainer(stableKey, children, styleObj, styleKey, () => (
        <View key={stableKey} style={styleObj}>
          {children}
        </View>
      ))
    }

  const makeTextRule =
    (styleKey: string) =>
    (
      node: MarkdownAstNodeLike,
      children: React.ReactNode,
      parentNodes: MarkdownAstNodeLike[],
      styles: Record<string, object | undefined>
    ) => {
      const stableKey = getStableAstNodeKey(node, parentNodes)
      const styleObj = styles[styleKey]
      return memoizer.memoizeContainer(stableKey, children, styleObj, styleKey, () => (
        <Text key={stableKey} style={styleObj}>
          {children}
        </Text>
      ))
    }

  const makeCodeRule =
    (styleKey: string, trimNewline: boolean) =>
    (
      node: MarkdownAstNodeLike,
      _children: React.ReactNode,
      parentNodes: MarkdownAstNodeLike[],
      styles: Record<string, object | undefined>,
      inheritedStyles: { color?: string } = {}
    ) => {
      const stableKey = getStableAstNodeKey(node, parentNodes)
      const content = trimNewline ? trimTrailingNewline(node.content) : (node.content ?? '')
      return getOrCreateLeaf(stableKey, content, styles[styleKey], inheritedStyles.color, () => (
        <Text key={stableKey} style={[inheritedStyles, styles[styleKey]]}>
          {content}
        </Text>
      ))
    }

  const makeBreakRule =
    (styleKey: string) =>
    (
      node: MarkdownAstNodeLike,
      _children: React.ReactNode,
      parentNodes: MarkdownAstNodeLike[],
      styles: Record<string, object | undefined>
    ) => {
      const stableKey = getStableAstNodeKey(node, parentNodes)
      return getOrCreateLeaf(stableKey, '\n', styles[styleKey], null, () => (
        <Text key={stableKey} style={styles[styleKey]}>
          {'\n'}
        </Text>
      ))
    }

  return {
    heading1: makeViewRule('_VIEW_SAFE_heading1'),
    heading2: makeViewRule('_VIEW_SAFE_heading2'),
    heading3: makeViewRule('_VIEW_SAFE_heading3'),
    heading4: makeViewRule('_VIEW_SAFE_heading4'),
    heading5: makeViewRule('_VIEW_SAFE_heading5'),
    heading6: makeViewRule('_VIEW_SAFE_heading6'),
    hr: (
      node: MarkdownAstNodeLike,
      _children: React.ReactNode,
      parentNodes: MarkdownAstNodeLike[],
      styles: Record<string, object | undefined>
    ) => {
      const stableKey = getStableAstNodeKey(node, parentNodes)
      return getOrCreateLeaf(stableKey, 'hr', styles._VIEW_SAFE_hr, null, () => (
        <View key={stableKey} style={styles._VIEW_SAFE_hr} />
      ))
    },
    strong: makeTextRule('strong'),
    em: makeTextRule('em'),
    s: makeTextRule('s'),
    bullet_list: makeViewRule('_VIEW_SAFE_bullet_list'),
    ordered_list: makeViewRule('_VIEW_SAFE_ordered_list'),
    list_item: (
      node: MarkdownAstNodeLike,
      children: React.ReactNode,
      parentNodes: MarkdownAstNodeLike[],
      styles: Record<string, object | undefined>,
      inheritedStyles: { color?: string } = {}
    ) => {
      const stableKey = getStableAstNodeKey(node, parentNodes)
      const orderedListIndex = parentNodes.findIndex((el) => el.type === 'ordered_list')
      const bulletListIndex = parentNodes.findIndex((el) => el.type === 'bullet_list')
      const isBullet =
        bulletListIndex !== -1 && (orderedListIndex === -1 || bulletListIndex < orderedListIndex)

      if (isBullet) {
        return memoizer.memoizeContainer(
          stableKey,
          children,
          styles._VIEW_SAFE_list_item,
          inheritedStyles.color ?? 'bullet',
          () => (
            <View key={stableKey} style={styles._VIEW_SAFE_list_item}>
              <Text style={[inheritedStyles, styles.bullet_list_icon]} accessible={false}>
                {BULLET_CHAR}
              </Text>
              <View style={styles._VIEW_SAFE_bullet_list_content}>{children}</View>
            </View>
          )
        )
      }

      if (orderedListIndex !== -1) {
        const orderedList = parentNodes[orderedListIndex]
        const listItemNumber =
          orderedList?.attributes?.start != null
            ? orderedList.attributes.start + (node.index ?? 0)
            : (node.index ?? 0) + 1
        return memoizer.memoizeContainer(
          stableKey,
          children,
          styles._VIEW_SAFE_list_item,
          `${listItemNumber}:${node.markup ?? ''}`,
          () => (
            <View key={stableKey} style={styles._VIEW_SAFE_list_item}>
              <Text style={[inheritedStyles, styles.ordered_list_icon]}>
                {listItemNumber}
                {node.markup}
              </Text>
              <View style={styles._VIEW_SAFE_ordered_list_content}>{children}</View>
            </View>
          )
        )
      }

      return memoizer.memoizeContainer(
        stableKey,
        children,
        styles._VIEW_SAFE_list_item,
        'plain',
        () => (
          <View key={stableKey} style={styles._VIEW_SAFE_list_item}>
            {children}
          </View>
        )
      )
    },
    code_inline: makeCodeRule('code_inline', false),
    code_block: makeCodeRule('code_block', true),
    fence: makeCodeRule('fence', true),
    table: makeViewRule('_VIEW_SAFE_table'),
    thead: makeViewRule('_VIEW_SAFE_thead'),
    tbody: makeViewRule('_VIEW_SAFE_tbody'),
    th: makeViewRule('_VIEW_SAFE_th'),
    tr: makeViewRule('_VIEW_SAFE_tr'),
    td: makeViewRule('_VIEW_SAFE_td'),
    hardbreak: makeBreakRule('hardbreak'),
    softbreak: makeBreakRule('softbreak'),
    body: (
      _node: MarkdownAstNodeLike,
      children: React.ReactNode,
      _parentNodes: MarkdownAstNodeLike[],
      styles: { _VIEW_SAFE_body?: object }
    ) => (
      <View key="md_body" style={styles._VIEW_SAFE_body}>
        {children}
      </View>
    ),
    textgroup: (
      node: MarkdownAstNodeLike,
      children: React.ReactNode,
      parentNodes: MarkdownAstNodeLike[],
      styles: { textgroup?: object }
    ) => {
      const stableKey = getStableAstNodeKey(node, parentNodes)
      return memoizer.memoizeContainer(stableKey, children, styles.textgroup, 'tg', () => (
        <Text key={stableKey} style={styles.textgroup}>
          {children}
        </Text>
      ))
    },
    text: (
      node: MarkdownAstNodeLike,
      _children: unknown,
      parentNodes: MarkdownAstNodeLike[],
      styles: { text?: { color?: string } },
      inheritedStyles: { color?: string } = {}
    ) => {
      const stableKey = getStableAstNodeKey(node, parentNodes)
      const content = node.content ?? ''
      const tailFadeChars = tailFadeCharsRef.current
      const fadeInfo =
        tailFadeChars > 0 ? getNodeTailFadeInfo(node, parentNodes, tailFadeChars) : null
      const baseColor = inheritedStyles.color ?? styles.text?.color ?? defaultTextColor
      const combinedTextStyle = [inheritedStyles, styles.text]

      if (!fadeInfo) {
        return getOrCreateLeaf(stableKey, content, styles.text, inheritedStyles.color, () => (
          <StreamingAnimatedText
            key={stableKey}
            content={content}
            fadeStartInNode={null}
            baseColor={baseColor}
            textStyle={combinedTextStyle}
          />
        ))
      }

      leafCache.delete(stableKey)
      return (
        <StreamingAnimatedText
          key={stableKey}
          content={content}
          fadeStartInNode={fadeInfo.fadeStartInNode}
          baseColor={baseColor}
          textStyle={combinedTextStyle}
        />
      )
    }
  }
}
