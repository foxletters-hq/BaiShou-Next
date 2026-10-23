import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

function read(name: string): string {
  return readFileSync(join(here, '..', name), 'utf8')
}

describe('pdf work off the electron main thread', () => {
  it('should render pdf pages in a worker instead of the main process', () => {
    const bitmap = read('register-desktop-pdf-bitmap-renderer.ts')
    const host = read('pdf-off-main.host.ts')
    const worker = read('pdf-off-main.worker.ts')
    expect(bitmap).toContain('renderPdfPagesOffMain')
    expect(bitmap).not.toContain('disableWorker')
    expect(bitmap).not.toContain('toBuffer')
    expect(host).toContain('?nodeWorker')
    expect(worker).toContain('disableWorker: true')
    expect(worker).toContain('parentPort')
    expect(worker).toContain("type: 'progress'")
    expect(host).toContain("message.type === 'progress'")
  })

  it('should parse pdf text off the main process', () => {
    const extractor = read('register-desktop-pdf-extractor.ts')
    expect(extractor).toContain('extractPdfTextsOffMain')
    expect(extractor).toContain('probePdfNumPagesOffMain')
    expect(extractor).not.toContain('readFileSync')
  })

  it('should drop leftover worker progress when the process starts again', () => {
    const consumer = read('knowledge-ingest-jobs.consumer.ts')
    expect(consumer).toContain('olderThanMs: 0')
    expect(consumer).toContain('reclaimedDeadProcessWork')
    expect(consumer).not.toContain('workerProgress')
  })
})
