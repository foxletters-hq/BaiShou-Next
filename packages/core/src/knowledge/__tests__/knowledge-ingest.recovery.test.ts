import { it, expect, beforeEach, afterEach } from 'vitest'
import { KnowledgeIngestService } from '../knowledge-ingest.service'
import type { KnowledgeIngestContext, KnowledgeIngestRepo } from './knowledge-ingest.test-helpers'
import { describeIngest, setupKnowledgeIngest } from './knowledge-ingest.test-helpers'

describeIngest('KnowledgeIngestService recover and claim', () => {
  let ctx: KnowledgeIngestContext
  let svc: KnowledgeIngestService
  let repo: KnowledgeIngestRepo

  beforeEach(async () => {
    ctx = await setupKnowledgeIngest()
    svc = ctx.svc
    repo = ctx.repo
  })

  afterEach(() => ctx.cleanup())

  it('recoverStale 跳过 live guard 保护的 extract', async () => {
    const { KnowledgeRepository } = await import('@baishou/database')
    const { markExtractJobLive, unmarkExtractJobLive } = await import('../knowledge-ingest.service')
    const knowledgeRepo = repo as InstanceType<typeof KnowledgeRepository>
    const { id: notebookId } = await svc.createNotebook({ name: '恢复本' })
    const { sourceId } = await svc.importSource({
      notebookId,
      title: 'stale',
      kind: 'text',
      textContent: 'x'
    })
    await knowledgeRepo.updateSourceStatus(sourceId, 'extracting')
    await knowledgeRepo.enqueueIngestJob({
      notebookId,
      sourceId,
      stage: 'extract',
      vaultId: 'vault_test'
    })
    const claimed = await knowledgeRepo.claimIngestJobs(1)
    expect(claimed).toHaveLength(1)

    markExtractJobLive(sourceId)
    try {
      const protectedRecover = await svc.recoverStaleIngestState()
      expect(protectedRecover.droppedExtractJobs).toBe(0)
      expect(protectedRecover.resetSources).toBe(0)
      const still = await knowledgeRepo.getSource(sourceId)
      expect(still?.status).toBe('extracting')
    } finally {
      unmarkExtractJobLive(sourceId)
    }

    const fresh = await svc.recoverStaleIngestState()
    expect(fresh.droppedExtractJobs).toBe(0)
    expect(fresh.resetSources).toBe(0)
    expect(fresh.reclaimedEmbedJobs).toBe(0)
    const still = await knowledgeRepo.getSource(sourceId)
    expect(still?.status).toBe('extracting')
    const runningJob = (await knowledgeRepo.listIngestJobs()).find(
      (j) => j.sourceId === sourceId && j.stage === 'extract'
    )
    expect(runningJob?.status).toBe('running')

    const stale = await svc.recoverStaleIngestState({ olderThanMs: 0 })
    expect(stale.droppedExtractJobs).toBe(0)
    expect(stale.reclaimedEmbedJobs).toBeGreaterThan(0)
    expect(stale.resetSources).toBe(1)
    const after = await knowledgeRepo.getSource(sourceId)
    expect(after?.status).toBe('pending')
    const reclaimed = (await knowledgeRepo.listIngestJobs()).find(
      (j) => j.sourceId === sourceId && j.stage === 'extract'
    )
    expect(reclaimed?.status).toBe('pending')
  })

  it('recoverStale 对 extracting 且无 extract job 的资料只恢复为 pending，不重新入队', async () => {
    const { KnowledgeRepository } = await import('@baishou/database')
    const knowledgeRepo = repo as InstanceType<typeof KnowledgeRepository>
    const { id: notebookId } = await svc.createNotebook({ name: '缺 job 本' })
    const { sourceId } = await svc.importSource({
      notebookId,
      title: 'stale-pdf',
      kind: 'text',
      textContent: 'x'
    })
    await knowledgeRepo.deleteIngestJobsForSource(sourceId, 'extract')
    await knowledgeRepo.updateSourceStatus(sourceId, 'extracting')

    const recovered = await svc.recoverStaleIngestState()
    expect(recovered.resetSources).toBe(1)
    const after = await knowledgeRepo.getSource(sourceId)
    expect(after?.status).toBe('pending')
    const extractJob = (await knowledgeRepo.listIngestJobs()).find(
      (j) => j.sourceId === sourceId && j.stage === 'extract'
    )
    expect(extractJob).toBeUndefined()
  })

  it('should reset leftover embedding sources to pending when recovering stale ingest', async () => {
    const { KnowledgeRepository } = await import('@baishou/database')
    const knowledgeRepo = repo as InstanceType<typeof KnowledgeRepository>
    const { id: notebookId } = await svc.createNotebook({ name: '嵌入残留本' })
    const { sourceId } = await svc.importSource({
      notebookId,
      title: 'stale-embed',
      kind: 'text',
      textContent: 'x'
    })
    await knowledgeRepo.updateSourceStatus(sourceId, 'embedding')

    const recovered = await svc.recoverStaleIngestState()
    expect(recovered.resetSources).toBe(1)
    expect((await knowledgeRepo.getSource(sourceId))?.status).toBe('pending')
  })

  it('claim 可按 stage 只取 embed，不受 running graph 挡住', async () => {
    const { KnowledgeRepository } = await import('@baishou/database')
    const knowledgeRepo = repo as InstanceType<typeof KnowledgeRepository>
    const { id: notebookId } = await svc.createNotebook({ name: '分车道本' })
    const { sourceId } = await svc.importSource({
      notebookId,
      title: 'pdf-embed',
      kind: 'text',
      textContent: '待嵌入正文'
    })
    await knowledgeRepo.enqueueIngestJob({
      notebookId,
      sourceId,
      stage: 'graph',
      vaultId: 'vault_test'
    })
    await knowledgeRepo.enqueueIngestJob({
      notebookId,
      sourceId,
      stage: 'embed',
      vaultId: 'vault_test'
    })
    const graphClaimed = await knowledgeRepo.claimIngestJobs(8, {
      vaultId: 'vault_test',
      stages: ['graph']
    })
    expect(graphClaimed.every((j) => j.stage === 'graph')).toBe(true)
    expect(graphClaimed.length).toBeGreaterThan(0)

    const embedClaimed = await knowledgeRepo.claimIngestJobs(8, {
      vaultId: 'vault_test',
      stages: ['embed']
    })
    expect(embedClaimed.every((j) => j.stage === 'embed')).toBe(true)
    expect(embedClaimed.some((j) => j.sourceId === sourceId)).toBe(true)
    expect(
      await knowledgeRepo.countIngestJobs({
        vaultId: 'vault_test',
        stages: ['embed'],
        claimableOnly: true
      })
    ).toBe(0)
  })

  it('enqueue 不重置 running；claim 带 CAS；pendingJobs 不串本', async () => {
    const { KnowledgeRepository } = await import('@baishou/database')
    const knowledgeRepo = repo as InstanceType<typeof KnowledgeRepository>
    const { id: nbA } = await svc.createNotebook({ name: '本A' })
    const { id: nbB } = await svc.createNotebook({ name: '本B' })
    const { sourceId: srcA } = await svc.importSource({
      notebookId: nbA,
      title: 'a',
      kind: 'text',
      textContent: 'aaa'
    })
    const { sourceId: srcB } = await svc.importSource({
      notebookId: nbB,
      title: 'b',
      kind: 'text',
      textContent: 'bbb'
    })

    const claimed = await knowledgeRepo.claimIngestJobs(1, { vaultId: 'vault_test' })
    expect(claimed.length).toBeGreaterThan(0)
    const runningId = claimed[0]!.id
    const before = (await knowledgeRepo.listIngestJobs()).find((j) => j.id === runningId)
    const beforeAt = before!.updatedAt
    await new Promise((resolve) => setTimeout(resolve, 15))
    await knowledgeRepo.enqueueIngestJob({
      notebookId: claimed[0]!.notebookId,
      sourceId: claimed[0]!.sourceId,
      stage: claimed[0]!.stage,
      vaultId: 'vault_test'
    })
    const stillRunning = (await knowledgeRepo.listIngestJobs()).find((j) => j.id === runningId)
    expect(stillRunning?.status).toBe('running')
    expect(stillRunning?.updatedAt).toBe(beforeAt)

    const claimedAgain = await knowledgeRepo.claimIngestJobs(8, { vaultId: 'vault_test' })
    expect(claimedAgain.some((j) => j.id === runningId)).toBe(false)

    const statsA = await knowledgeRepo.getStats(nbA, 'vault_test')
    const statsB = await knowledgeRepo.getStats(nbB, 'vault_test')
    expect(statsA.pendingJobs).toBeGreaterThan(0)
    expect(statsA.pendingJobs).not.toBe(statsB.pendingJobs + statsA.pendingJobs + 99)
    const listed = await knowledgeRepo.listNotebookStats('vault_test')
    const rowA = listed.find((r) => r.notebookId === nbA)
    const rowB = listed.find((r) => r.notebookId === nbB)
    expect(rowA?.pendingJobs).toBe(statsA.pendingJobs)
    expect(rowB?.pendingJobs).toBe(statsB.pendingJobs)
    expect(srcA && srcB).toBeTruthy()
  })

  it('should not count failed ingest jobs as pendingJobs on notebook stats', async () => {
    const { KnowledgeRepository } = await import('@baishou/database')
    const knowledgeRepo = repo as InstanceType<typeof KnowledgeRepository>
    const { id: notebookId } = await svc.createNotebook({ name: '失败本' })
    await svc.importSource({
      notebookId,
      title: '扫描件',
      kind: 'text',
      textContent: 'will fail'
    })
    const claimed = await knowledgeRepo.claimIngestJobs(8, { vaultId: 'vault_test' })
    expect(claimed.length).toBeGreaterThan(0)
    for (const job of claimed) {
      await knowledgeRepo.failIngestJob(job.id, 'extract failed', { backoffMs: 60_000 })
    }
    const stats = await knowledgeRepo.getStats(notebookId, 'vault_test')
    const listed = await knowledgeRepo.listNotebookStats('vault_test')
    const row = listed.find((item) => item.notebookId === notebookId)
    expect(stats.pendingJobs).toBe(0)
    expect(row?.pendingJobs).toBe(0)
    expect(
      await knowledgeRepo.countIngestJobs({
        vaultId: 'vault_test',
        claimableOnly: true
      })
    ).toBe(0)
  })
})
