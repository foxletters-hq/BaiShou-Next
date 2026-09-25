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
    expect(consumer).toContain('onExtractProgress: emitMobileKnowledgeExtractProgress')
    expect(consumer).toContain('recoverStaleIngestState')
    expect(consumer).not.toContain('mobile-skip-pdf-extract')
    expect(service).toContain('export async function mobileCancelExtract')
    expect(service).toContain('export async function mobileRecoverStaleIngest')
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
})
