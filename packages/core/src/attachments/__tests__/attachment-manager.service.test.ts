import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { AttachmentManagerService } from '../attachment-manager.service'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'

describe('AttachmentManagerService', () => {
  let tempDir: string
  let service: AttachmentManagerService
  let mockPathService: any

  beforeEach(async () => {
    // 建立临时测试目录
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'baishou-attachments-test-'))

    mockPathService = {
      getAttachmentsBaseDirectory: vi.fn().mockResolvedValue(tempDir),
      getAvatarsDirectory: vi.fn().mockResolvedValue(path.join(tempDir, 'avatars'))
    }

    service = new AttachmentManagerService(mockPathService)
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => null)
  })

  it('should list session groups correctly with active and orphan sessions', async () => {
    const session1 = 'session-active-id'
    const session2 = 'session-orphan-id'

    const dir1 = path.join(tempDir, session1)
    const dir2 = path.join(tempDir, session2)

    await fs.mkdir(dir1, { recursive: true })
    await fs.mkdir(dir2, { recursive: true })

    // 写入模拟附件
    await fs.writeFile(path.join(dir1, 'file1.txt'), 'hello content')
    await fs.writeFile(path.join(dir1, 'file2.jpg'), 'image content')
    await fs.writeFile(path.join(dir2, 'orphan.pdf'), 'pdf content')

    const activeSessions = new Set([session1])

    const groups = await service.listSessionGroups(activeSessions)

    expect(groups.length).toBe(2)

    const activeGroup = groups.find((g) => g.sessionId === session1)
    expect(activeGroup).toBeDefined()
    expect(activeGroup!.isOrphan).toBe(false)
    expect(activeGroup!.fileCount).toBe(2)
    expect(activeGroup!.files.some((f) => f.name === 'file1.txt')).toBe(true)

    const orphanGroup = groups.find((g) => g.sessionId === session2)
    expect(orphanGroup).toBeDefined()
    expect(orphanGroup!.isOrphan).toBe(true)
    expect(orphanGroup!.fileCount).toBe(1)
    expect(orphanGroup!.files[0]!.name).toBe('orphan.pdf')
  })

  it('should auto nuke empty attachment directories during scanning', async () => {
    const emptySessionId = 'empty-session-id'
    const emptyDir = path.join(tempDir, emptySessionId)
    await fs.mkdir(emptyDir, { recursive: true })

    const groups = await service.listSessionGroups(new Set())

    // 空目录应该被扫描逻辑自动清除，且不包含在返回的分组中
    expect(groups.length).toBe(0)
    expect(existsSync(emptyDir)).toBe(false)
  })

  it('should delete specific file and cleanup parent dir if it becomes empty', async () => {
    const session1 = 'session-id'
    const dir = path.join(tempDir, session1)
    await fs.mkdir(dir, { recursive: true })

    await fs.writeFile(path.join(dir, 'file1.txt'), 'content1')
    await fs.writeFile(path.join(dir, 'file2.txt'), 'content2')

    // 1. 删除 file1，此时目录下还剩 file2，目录应当保留
    await service.deleteFile(session1, 'file1.txt')
    expect(existsSync(path.join(dir, 'file1.txt'))).toBe(false)
    expect(existsSync(path.join(dir, 'file2.txt'))).toBe(true)
    expect(existsSync(dir)).toBe(true)

    // 2. 删除 file2，目录变为空，应当自动被清除
    await service.deleteFile(session1, 'file2.txt')
    expect(existsSync(path.join(dir, 'file2.txt'))).toBe(false)
    expect(existsSync(dir)).toBe(false)
  })

  it('should ignore directory traversal attacks in deleteFile', async () => {
    const session1 = 'session-id'
    const dir = path.join(tempDir, session1)
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(path.join(dir, 'file1.txt'), 'content1')

    // 模拟恶意文件名尝试删除上级目录中的其他文件
    const attackerFileName = '../another-file.txt'
    const anotherFilePath = path.join(tempDir, 'another-file.txt')
    await fs.writeFile(anotherFilePath, 'secret data')

    await service.deleteFile(session1, attackerFileName)

    // 恶意的路径应该被过滤掉，且上级敏感文件不被影响
    expect(existsSync(anotherFilePath)).toBe(true)
    expect(existsSync(path.join(dir, 'file1.txt'))).toBe(true)
  })
})
