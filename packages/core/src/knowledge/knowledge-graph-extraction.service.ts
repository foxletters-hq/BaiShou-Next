import {
  notebookGraphExtractStateId,
  notebookGraphSourceNodeId,
  rethrowKnowledgeGraphStepError,
  type KnowledgeGraphStep,
  type NotebookGraphExtractStateRawRecord,
  type NotebookGraphExtractedWindowPayload,
  type NotebookGraphNodeRawRecord
} from '@baishou/shared'
import {
  type NotebookGraphEmbedding,
  type NotebookGraphExtractStore,
  type NotebookGraphQuery
} from '@baishou/database/shared'
import { logger } from '@baishou/shared'
import {
  isNotebookGraphExtractComplete,
  shouldRunNotebookGraphAlignOnly
} from './notebook-graph-extract-checkpoint.util'
import type { NotebookGraphExtractRaw } from './notebook-graph-extract-raw'
import type { NotebookGraphIndexService } from './notebook-graph-index.service'
import { notebookGraphDeletedShardPaths } from '../raw-data/notebook-graph-shard-key.util'
import {
  knowledgeGraphExtractProgress,
  knowledgeGraphPageTotal,
  splitKnowledgeGraphWindows
} from './knowledge-graph-windows.util'
import {
  isKnowledgeGraphExtractWindowSkipError,
  parseExtractJson,
  shouldSupersedeNotebookAiEdges,
  type KnowledgeGraphExtractAlignDeps,
  type KnowledgeGraphExtractInput,
  type KnowledgeGraphExtractLlm
} from './knowledge-graph-extraction.helpers'
import { clipNameCandidateSourceContext } from '../graph/graph-entity-align'
import { commitAlignedWindows, writeAlignedEmbeddings } from './knowledge-graph-extraction.align'

async function runKnowledgeGraphStep<T>(
  step: KnowledgeGraphStep,
  run: () => Promise<T>
): Promise<T> {
  try {
    return await run()
  } catch (error) {
    rethrowKnowledgeGraphStepError(step, error)
  }
}

export type {
  KnowledgeGraphExtractAlignDeps,
  KnowledgeGraphExtractInput,
  KnowledgeGraphExtractLlm
} from './knowledge-graph-extraction.helpers'
export { shouldSupersedeNotebookAiEdges } from './knowledge-graph-extraction.helpers'

export class KnowledgeGraphExtractionService {
  constructor(
    private readonly deps: {
      raw: NotebookGraphExtractRaw
      repo: NotebookGraphExtractStore &
        Partial<NotebookGraphEmbedding> &
        Pick<NotebookGraphQuery, 'findNodesByNameOrAlias'>
      index: Pick<NotebookGraphIndexService, 'syncPendingIndex'>
      llm: KnowledgeGraphExtractLlm
      getVaultName: () => string
      align?: KnowledgeGraphExtractAlignDeps | null
    }
  ) {}

  async extractSource(
    input: KnowledgeGraphExtractInput
  ): Promise<{ windows: number; truncated: boolean; skipped?: string }> {
    const vaultId = input.vaultId.trim()
    const notebookId = input.notebookId.trim()
    if (!vaultId || !notebookId) throw new Error('extractSource: vaultId and notebookId required')

    if (input.force) {
      if (this.deps.raw.deleteSourceShards) {
        await this.deps.raw.deleteSourceShards(notebookId, input.sourceId)
      }
      await this.deps.index.syncPendingIndex({
        vaultId,
        notebookId,
        deletedShardPaths: notebookGraphDeletedShardPaths(notebookId, input.sourceId)
      })
    }

    const existing = input.force
      ? null
      : await this.deps.raw.getExtractState(notebookId, input.sourceId)
    if (isNotebookGraphExtractComplete(existing, input.textHash)) {
      return {
        windows: existing!.windowsDone,
        truncated: Boolean(existing!.truncated),
        skipped: 'unchanged'
      }
    }

    const { windows, truncated } = splitKnowledgeGraphWindows(
      input.text,
      input.sourceId,
      input.pages
    )
    const pageTotal = knowledgeGraphPageTotal(input.pages)
    const reportProgress = (windowsDone: number) =>
      input.onProgress?.(knowledgeGraphExtractProgress(windows, windowsDone, pageTotal))
    await reportProgress(0)
    const vaultName = this.deps.getVaultName()
    const now = Date.now()
    const shardKey = input.sourceId.trim()
    const sourceNode = this.buildSourceNode({
      vaultId,
      vaultName,
      notebookId,
      sourceId: input.sourceId,
      title: input.sourceTitle,
      shardMonth: shardKey,
      now
    })

    const sameHash = existing?.extractedTextHash === input.textHash
    let extractedWindows: NotebookGraphExtractedWindowPayload[] =
      sameHash && Array.isArray(existing?.extractedWindows)
        ? existing.extractedWindows.map((win) => ({ ...win }))
        : []
    const skipExtract = shouldRunNotebookGraphAlignOnly(existing, input.textHash)

    try {
      if (!skipExtract) {
        const doneIndexes = new Set(
          extractedWindows
            .map((win) => win.index)
            .filter((index) => Number.isInteger(index) && index >= 0)
        )
        for (let i = 0; i < windows.length; i += 1) {
          if (doneIndexes.has(i)) continue
          const win = windows[i]!
          // 界面按这一窗盖住的页码报进度；检查点 windowsDone 仍只在解析成功后写入
          await reportProgress(i + 1)
          const payload = await this.extractWindow(win.text)
          if (!payload) continue
          extractedWindows.push({
            index: i,
            sourceRef: win.sourceRef,
            sourceContext: clipNameCandidateSourceContext(win.text),
            entities: payload.entities,
            edges: payload.edges
          })
          await this.deps.raw.replaceSourceGraph({
            notebookId,
            sourceId: input.sourceId,
            nodes: [sourceNode],
            edges: [],
            extractState: this.buildExtractState({
              vaultId,
              vaultName,
              notebookId,
              sourceId: input.sourceId,
              textHash: input.textHash,
              windowsDone: extractedWindows.length,
              windowsTotal: windows.length,
              truncated,
              extractedWindows,
              alignWritten: false,
              now
            })
          })
        }
      } else {
        await reportProgress(windows.length)
      }
    } catch (error) {
      rethrowKnowledgeGraphStepError('extract', error)
    }

    if (extractedWindows.length === 0 && windows.length > 0) {
      await this.deps.raw.replaceSourceGraph({
        notebookId,
        sourceId: input.sourceId,
        nodes: [sourceNode],
        edges: [],
        extractState: this.buildExtractState({
          vaultId,
          vaultName,
          notebookId,
          sourceId: input.sourceId,
          textHash: input.textHash,
          windowsDone: windows.length,
          windowsTotal: windows.length,
          truncated,
          extractedWindows: [],
          alignWritten: true,
          now
        })
      })
      await reportProgress(windows.length)
      logger.info('[KnowledgeGraphExtract] done', {
        sourceId: input.sourceId,
        windows: 0,
        truncated
      })
      return { windows: 0, truncated }
    }

    const committed = await runKnowledgeGraphStep('align', () =>
      commitAlignedWindows(this.deps, {
        vaultId,
        vaultName,
        notebookId,
        sourceId: input.sourceId,
        textHash: input.textHash,
        shardKey,
        now,
        sourceNode,
        extractedWindows
      })
    )

    await this.deps.raw.replaceSourceGraph({
      notebookId,
      sourceId: input.sourceId,
      nodes: committed.nodes,
      edges: committed.edges,
      extractState: this.buildExtractState({
        vaultId,
        vaultName,
        notebookId,
        sourceId: input.sourceId,
        textHash: input.textHash,
        windowsDone: Math.max(extractedWindows.length, windows.length),
        windowsTotal: windows.length,
        truncated,
        extractedWindows,
        alignWritten: true,
        now
      })
    })
    await reportProgress(Math.max(extractedWindows.length, windows.length))

    if (shouldSupersedeNotebookAiEdges(committed.exceptIds)) {
      await this.deps.repo.supersedeAiEdgesBySourcePrefix({
        notebookId,
        sourceRefPrefix: input.sourceId,
        exceptIds: committed.exceptIds
      })
    }
    await this.deps.index.syncPendingIndex({ vaultId, notebookId })
    await runKnowledgeGraphStep('node-embed', () =>
      writeAlignedEmbeddings(this.deps, vaultId, notebookId, committed.pendingEmbeddings)
    )
    logger.info('[KnowledgeGraphExtract] done', {
      sourceId: input.sourceId,
      windows: extractedWindows.length,
      truncated
    })
    return { windows: extractedWindows.length, truncated }
  }

  private buildSourceNode(input: {
    vaultId: string
    vaultName: string
    notebookId: string
    sourceId: string
    title: string
    shardMonth: string
    now: number
  }): NotebookGraphNodeRawRecord {
    return {
      id: notebookGraphSourceNodeId(input.vaultId, input.notebookId, input.sourceId),
      schemaVersion: 1,
      vaultId: input.vaultId,
      vaultName: input.vaultName,
      notebookId: input.notebookId,
      nodeType: 'source',
      name: input.title || input.sourceId,
      aliases: [input.sourceId],
      summary: '',
      props: { sourceId: input.sourceId },
      mentionCount: 1,
      firstSeenAt: input.now,
      lastSeenAt: input.now,
      origin: 'ai',
      shardMonth: input.shardMonth,
      createdAt: input.now,
      updatedAt: input.now,
      deletedAt: null,
      reviewStatus: 'approved'
    }
  }

  private buildExtractState(input: {
    vaultId: string
    vaultName: string
    notebookId: string
    sourceId: string
    textHash: string
    windowsDone: number
    windowsTotal: number
    truncated: boolean
    extractedWindows?: NotebookGraphExtractedWindowPayload[]
    alignWritten?: boolean
    now: number
  }): NotebookGraphExtractStateRawRecord {
    return {
      id: notebookGraphExtractStateId(input.notebookId, input.sourceId),
      schemaVersion: 1,
      vaultId: input.vaultId,
      vaultName: input.vaultName,
      notebookId: input.notebookId,
      sourceId: input.sourceId,
      extractedTextHash: input.textHash,
      windowsDone: input.windowsDone,
      windowsTotal: input.windowsTotal,
      truncated: input.truncated,
      extractedWindows: input.extractedWindows,
      alignWritten: input.alignWritten,
      extractedAt: input.now,
      updatedAt: input.now,
      deletedAt: null
    }
  }

  private async extractWindow(text: string): Promise<{
    entities: Array<{
      name?: string
      type?: string
      aliases?: string[]
      summary?: string
      confidence?: number
    }>
    edges: Array<{
      from?: string
      to?: string
      type?: string
      excerpt?: string
      confidence?: number
    }>
  } | null> {
    try {
      const raw = await this.deps.llm({
        system:
          '你从资料片段抽取实体和关系。只输出 JSON：{"entities":[{"name","type","aliases","summary","confidence"}],"edges":[{"from","to","type","excerpt","confidence"}]}。type 只能是 person/place/organization/event/emotion/topic/work/activity/product/food。edge type 只能是 mentions/participates_in/located_at/evokes/role_of/relates_to。confidence 用 0 到 100 的整数，不要用 0 到 1。不要编造资料中没有的内容。',
        user: text.slice(0, 8000)
      })
      return parseExtractJson(raw)
    } catch (error) {
      if (isKnowledgeGraphExtractWindowSkipError(error)) {
        logger.warn('[KnowledgeGraphExtract] window timed out, skip', {
          message: error instanceof Error ? error.message : String(error)
        })
        return null
      }
      throw error
    }
  }
}
