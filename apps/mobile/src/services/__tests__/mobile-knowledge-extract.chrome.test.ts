import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const dir = dirname(fileURLToPath(import.meta.url))

function readService(name: string): string {
  return readFileSync(join(dir, '..', name), 'utf8')
}

describe('mobile knowledge extract alignment chrome', () => {
  it('should wire extract config, recover stale, and stop skipping PDF extract', () => {
    const consumer = readService('mobile-knowledge-ingest-jobs.consumer.ts')
    const service = readService('mobile-knowledge.service.ts')
    const extract = readService('mobile-graph-extract.ts')
    const bootstrap = readFileSync(
      join(dir, '..', '..', 'providers', 'baishou-provider', 'bootstrap-mobile-baishou-core.ts'),
      'utf8'
    )
    expect(consumer).toContain('getExtractConfig: resolveMobileKnowledgeExtractConfig')
    expect(consumer).toContain("skipped: 'embedding-not-configured'")
    expect(consumer).toContain('[MobileKnowledgeIngestJobs] done')
    expect(consumer).toContain('emitMobileKnowledgeIngestLive')
    expect(consumer).toContain('onExtractProgress: emitMobileKnowledgeExtractProgress')
    expect(consumer).toContain('recoverStaleIngestState')
    expect(consumer).toContain('export async function recoverMobileKnowledgeIngestOnStartup')
    expect(consumer).toContain('reclaimedDeadProcessWork')
    expect(consumer).toContain('olderThanMs: 0')
    expect(consumer).not.toContain('mobile-skip-pdf-extract')
    expect(bootstrap).toContain('recoverMobileKnowledgeIngestOnStartup')
    expect(bootstrap).not.toContain("scheduleConsumeMobileKnowledgeIngestJobs('bootstrap')")
    expect(bootstrap).not.toContain('scheduleConsumeMobileKnowledgeIngestJobs')
    expect(service).toContain('export async function mobileCancelExtract')
    expect(service).toContain('export async function mobileRecoverStaleIngest')
    expect(service).toContain('recoverStaleIngestState({ olderThanMs: 0 })')
    expect(service).not.toContain("kickMobileKnowledgeIngest('recover')")
    expect(service).toContain('export async function mobileEmbedSource')
    expect(service).toContain('export async function mobileGetExtractedPreview')
    expect(service).toContain('export async function mobileOcrMissingPages')
    expect(extract).toContain('listSourceIdsByType')
    expect(extract).toContain('SqliteHybridSearchRepository')
    expect(extract).toContain('listSourceIdsByType')
    expect(bootstrap).toContain('registerMobilePdfExtractor')
    expect(bootstrap).toContain('registerMobilePdfPageBitmapRenderer')
    expect(bootstrap).toContain('registerMobileVisionPageRecognizer')
  })

  it('should report notebook graph extract window progress to the organize banner', () => {
    const graphExtract = readService('mobile-knowledge-graph-extract.ts')
    expect(graphExtract).toContain('onProgress')
    expect(graphExtract).toContain("'graphNodes'")
    expect(graphExtract).toContain('nodesTotal')
    expect(graphExtract).toContain('windowsDone')
    expect(graphExtract).toContain('pageTotal')
    expect(graphExtract).toContain('GRAPH_EXTRACT_CONCURRENCY_STORAGE_KEY')
    expect(graphExtract).toContain('resolveGraphExtractConcurrency')
    expect(graphExtract).toContain('mobileGraphExtractQueue.getConcurrency()')
    expect(graphExtract).toContain(
      'windowConcurrency: await resolveMobileKnowledgeGraphWindowConcurrency()'
    )
    expect(graphExtract).not.toContain('windowConcurrency: 2')
    const consumer = readService('mobile-knowledge-ingest-jobs.consumer.ts')
    expect(consumer).toContain('waitForIdle')
  })

  it('should send mobile PDFs to vision only and never fall back to the PDF text layer', () => {
    const extractConfig = readService('mobile-knowledge-extract-config.ts')
    expect(extractConfig).toContain('pdfVisionOnly: true')
  })
})
