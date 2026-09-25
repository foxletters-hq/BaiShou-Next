import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'mobile-knowledge.service.ts'),
  'utf8'
)

describe('mobile knowledge maintenance chrome', () => {
  it('should rebuild index through core and expose source graph maintenance', () => {
    expect(src).toContain('await svc.rebuildIndex(id)')
    expect(src).toContain('export async function mobileRetrySource')
    expect(src).toContain('export async function mobileReprocessSource')
    expect(src).toContain('export async function mobileRebuildNotebookGraph')
    expect(src).toContain('await svc.retrySource(id)')
    expect(src).toContain('await svc.reprocessSource(id, target)')
    expect(src).toContain('await svc.rebuildNotebookGraph(id)')
    expect(src).toContain('kickMobileKnowledgeIngest')
    expect(src).toContain('followGraph: true')
    expect(src).not.toContain("stage: 'embed'")
  })

  it('should create, reorder, organize, and import files with process mode', () => {
    expect(src).toContain('export async function mobileCreateNotebook')
    expect(src).toContain('export async function mobileReorderNotebooks')
    expect(src).toContain('export async function mobileOrganizeNotebook')
    expect(src).toContain("kind: 'file' | 'text' | 'url'")
    expect(src).toContain('importProcessMode')
    expect(src).toContain('resolveMobileKnowledgeFilePath')
  })
})
