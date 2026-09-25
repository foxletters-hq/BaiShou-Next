import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

describe('knowledge graph jobs ipc chrome', () => {
  it('should return lastError and extract-state windows from list-graph-jobs', () => {
    const ipc = readFileSync(join(here, '..', 'knowledge-graph.ipc.ts'), 'utf8')
    expect(ipc).toContain("handleKnowledgeIpc('knowledge:list-graph-jobs'")
    expect(ipc).toContain('lastError')
    expect(ipc).toContain('failedSourceTitle')
    expect(ipc).toContain('getExtractState')
    expect(ipc).toContain('windowsDone')
    expect(ipc).toContain('windowsTotal')
    expect(ipc).toContain('resolveListedGraphWindowProgress')
    expect(ipc).toContain('resolveListedGraphJobStatus')
    expect(ipc).toContain('shouldResumeListedGraphJobs')
    expect(ipc).toContain('consumeKnowledgeGraphJobs')
    expect(ipc).toContain("reason: 'list-graph-jobs'")
    expect(ipc).toContain('readGraphWindowProgress')
  })

  it('should send the graph provider into generateContent instead of the summary slot', () => {
    const extract = readFileSync(
      join(here, '../../services/desktop-knowledge-graph-extract.ts'),
      'utf8'
    )
    expect(extract).toContain('rememberGraphWindowProgress')
    expect(extract).toContain('GRAPH_EXTRACT_WINDOW_TIMEOUT_MS')
    expect(extract).toContain('abortSignal: AbortSignal.timeout(GRAPH_EXTRACT_WINDOW_TIMEOUT_MS)')
    const summary = readFileSync(join(here, '../summary-ai-client.ts'), 'utf8')
    expect(summary).toContain('idleTimeoutMs: SUMMARY_AI_IDLE_TIMEOUT_MS')
    expect(extract).toContain('graph-extract-window-timeout')
    expect(extract).toContain('const { providerId, modelId } = resolveGlobalGraphModelIds')
    expect(extract).toMatch(/generateContent\([\s\S]*?providerId/)
    const suspect = readFileSync(join(here, '../../services/graph-suspect-scan.service.ts'), 'utf8')
    expect(suspect).toContain('const { providerId, modelId } = resolveGlobalGraphModelIds')
    expect(suspect).toMatch(/generateContent\([\s\S]*?providerId/)
  })
})
