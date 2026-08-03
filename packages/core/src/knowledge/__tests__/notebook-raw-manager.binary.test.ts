import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as os from 'node:os'
import { createHash } from 'node:crypto'
import { createNodeFileSystem } from '../../fs/create-node-file-system'
import { NotebookRawManager } from '../../raw-data/managers/notebook.raw-manager'
import type { IStoragePathService } from '../../vault/storage-path.types'

describe('NotebookRawManager binary safety', () => {
  let tempDir: string
  let notebooksDir: string
  let manager: NotebookRawManager

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'baishou-nb-raw-'))
    notebooksDir = path.join(tempDir, 'Notebooks')
    await fs.mkdir(notebooksDir, { recursive: true })
    const fsApi = createNodeFileSystem()
    const pathService = {
      getNotebooksBaseDirectory: async () => notebooksDir,
      getActiveVaultPath: async () => tempDir
    } as unknown as IStoragePathService
    manager = new NotebookRawManager(pathService, fsApi)
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined)
  })

  it('PDF 写入读回字节级一致（copyFile）', async () => {
    // 构造含非 UTF-8 字节的伪 PDF
    const pdfBytes = Buffer.from([
      0x25,
      0x50,
      0x44,
      0x46,
      0x2d,
      0x31,
      0x2e,
      0x34, // %PDF-1.4
      0x00,
      0xff,
      0xfe,
      0x80,
      0x81,
      0x82,
      0x00,
      0x0a
    ])
    const srcPath = path.join(tempDir, 'report.pdf')
    await fs.writeFile(srcPath, pdfBytes)

    const { contentHash } = await manager.copySourceFile('nb1/sources/report.pdf', srcPath)
    const dest = path.join(notebooksDir, 'nb1', 'sources', 'report.pdf')
    const roundtrip = await fs.readFile(dest)

    expect(Buffer.compare(pdfBytes, roundtrip)).toBe(0)
    expect(contentHash).toBe(createHash('md5').update(pdfBytes).digest('hex'))
  })

  it('Uint8Array 写盘字节一致', async () => {
    const bytes = new Uint8Array([0x00, 0x01, 0xfe, 0xff, 0x80])
    await manager.writeFile('nb1/sources/bin.dat', bytes, { skipVersion: true })
    const dest = path.join(notebooksDir, 'nb1', 'sources', 'bin.dat')
    const roundtrip = await fs.readFile(dest)
    expect(Buffer.compare(Buffer.from(bytes), roundtrip)).toBe(0)
  })
})
