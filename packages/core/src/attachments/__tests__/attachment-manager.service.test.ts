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
      getAvatarsDirectory: vi.fn().mockResolvedValue(path.join(tempDir, 'avatars')),
      getUserAvatarsDirectory: vi.fn().mockResolvedValue(path.join(tempDir, 'user-avatars')),
      getJournalsBaseDirectory: vi.fn().mockResolvedValue(path.join(tempDir, 'Journals'))
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

  it('should scan diary attachments and filter out orphans based on references', async () => {
    const journalsDir = path.join(tempDir, 'Journals')
    const yearMonthDir = path.join(journalsDir, '2026', '05')
    const attachDir = path.join(yearMonthDir, 'attachment')

    await fs.mkdir(attachDir, { recursive: true })

    // 写入模拟附件
    const activePath = path.join(attachDir, 'active-img.png')
    const orphanPath = path.join(attachDir, 'orphan-img.png')
    await fs.writeFile(activePath, 'active content')
    await fs.writeFile(orphanPath, 'orphan content')

    // 写入含有引用的日记
    const diaryContent = `---
id: 100
date: 2026-05-25
---
今天画了一张很好看的画：![[active-img.png]]，还有 [[active-img.png]]，非常好！
`
    await fs.writeFile(path.join(yearMonthDir, '2026-05-25.md'), diaryContent, 'utf8')

    const list = await service.listDiaryAttachments()

    expect(list.length).toBe(2)

    const activeItem = list.find((item) => item.name === 'active-img.png')
    expect(activeItem).toBeDefined()
    expect(activeItem!.isOrphan).toBe(false)
    expect(activeItem!.yearMonth).toBe('2026-05')
    expect(activeItem!.relativePath).toBe('2026/05/attachment/active-img.png')

    const orphanItem = list.find((item) => item.name === 'orphan-img.png')
    expect(orphanItem).toBeDefined()
    expect(orphanItem!.isOrphan).toBe(true)
  })

  it('should scan and identify multiple reference patterns correctly', async () => {
    const journalsDir = path.join(tempDir, 'Journals')
    const yearMonthDir = path.join(journalsDir, '2026', '06')
    const attachDir = path.join(yearMonthDir, 'attachment')

    await fs.mkdir(attachDir, { recursive: true })

    const file1 = path.join(attachDir, 'img1.png')
    const file2 = path.join(attachDir, 'img2.jpg')
    const file3 = path.join(attachDir, 'doc.pdf')
    await fs.writeFile(file1, '1')
    await fs.writeFile(file2, '2')
    await fs.writeFile(file3, '3')

    const diaryContent = `---
date: 2026-06-01
---
标准 markdown 图片：![alt](attachment/img1.png)
HTML 图片：<img src="attachment/img2.jpg" />
非图片文档链接：[下载](attachment/doc.pdf)
`
    await fs.writeFile(path.join(yearMonthDir, '2026-06-01.md'), diaryContent, 'utf8')

    const list = await service.listDiaryAttachments()
    const juneList = list.filter((item) => item.yearMonth === '2026-06')

    expect(juneList.length).toBe(3)
    expect(juneList.every((item) => !item.isOrphan)).toBe(true)
  })

  it('should safely delete diary attachment and nuke empty year/month/attachment folders', async () => {
    const journalsDir = path.join(tempDir, 'Journals')
    const yearMonthDir = path.join(journalsDir, '2026', '07')
    const attachDir = path.join(yearMonthDir, 'attachment')

    await fs.mkdir(attachDir, { recursive: true })

    const fileToDelete = path.join(attachDir, 'todelete.png')
    await fs.writeFile(fileToDelete, 'some content')

    expect(existsSync(fileToDelete)).toBe(true)

    // 执行物理删除
    await service.deleteDiaryAttachment(fileToDelete)

    // 验证文件消失
    expect(existsSync(fileToDelete)).toBe(false)
    // 验证空 attachment、month、year 目录被级联彻底清除
    expect(existsSync(attachDir)).toBe(false)
    expect(existsSync(yearMonthDir)).toBe(false)
    expect(existsSync(path.dirname(yearMonthDir))).toBe(false)
    // 但 Journals 根目录依然要在
    expect(existsSync(journalsDir)).toBe(true)
  })

  it('should handle case-insensitive matching correctly for references', async () => {
    const journalsDir = path.join(tempDir, 'Journals')
    const yearMonthDir = path.join(journalsDir, '2026', '08')
    const attachDir = path.join(yearMonthDir, 'attachment')

    await fs.mkdir(attachDir, { recursive: true })

    const file = path.join(attachDir, 'CASE-SENSITIVE-FILE.PNG')
    await fs.writeFile(file, 'image data')

    // 引用使用小写
    const diaryContent = `---
date: 2026-08-01
---
引用小写：![img](attachment/case-sensitive-file.png)
`
    await fs.writeFile(path.join(yearMonthDir, '2026-08-01.md'), diaryContent, 'utf8')

    const list = await service.listDiaryAttachments()
    const item = list.find((i) => i.yearMonth === '2026-08')

    expect(item).toBeDefined()
    expect(item!.isOrphan).toBe(false)
  })

  it('should fallback to plain-text includes matching for frontmatter mediaPaths or complex references', async () => {
    const journalsDir = path.join(tempDir, 'Journals')
    const yearMonthDir = path.join(journalsDir, '2026', '09')
    const attachDir = path.join(yearMonthDir, 'attachment')

    await fs.mkdir(attachDir, { recursive: true })

    const file = path.join(attachDir, 'frontmatter-ref.png')
    await fs.writeFile(file, 'image data')

    // 正文没有 markdown 链接引用，但 Frontmatter 或者是纯文本中有提及文件名
    const diaryContent = `---
date: 2026-09-01
mediaPaths: ["attachment/frontmatter-ref.png"]
---
日记正文，没有 markdown 图片引用。
`
    await fs.writeFile(path.join(yearMonthDir, '2026-09-01.md'), diaryContent, 'utf8')

    const list = await service.listDiaryAttachments()
    const item = list.find((i) => i.yearMonth === '2026-09')

    expect(item).toBeDefined()
    expect(item!.isOrphan).toBe(false) // 孤立判定应为 false，因为被兜底 includes 检测发现
  })

  it('should handle URL-encoded filenames (like Chinese or spaces) correctly without marking them as orphans', async () => {
    const journalsDir = path.join(tempDir, 'Journals')
    const yearMonthDir = path.join(journalsDir, '2026', '10')
    const attachDir = path.join(yearMonthDir, 'attachment')

    await fs.mkdir(attachDir, { recursive: true })

    const file = path.join(attachDir, '我的 图片.png')
    await fs.writeFile(file, 'image data')

    // 含有中文字符与空格，在 Markdown 中使用百分号编码引用
    const diaryContent = `---
date: 2026-10-01
---
引用的图片链接：[我的图片](attachment/%E6%88%91%E7%9A%84%20%E5%9B%BE%E7%89%87.png)
`
    await fs.writeFile(path.join(yearMonthDir, '2026-10-01.md'), diaryContent, 'utf8')

    const list = await service.listDiaryAttachments()
    const item = list.find((i) => i.yearMonth === '2026-10')

    expect(item).toBeDefined()
    expect(item!.isOrphan).toBe(false) // 因为做了解码比对，所以不应该是孤立附件
  })

  it('resolves user avatars from global storage and migrates legacy vault copies', async () => {
    const globalDir = path.join(tempDir, 'user-avatars')
    const vaultDir = path.join(tempDir, 'avatars')
    await fs.mkdir(globalDir, { recursive: true })
    await fs.mkdir(vaultDir, { recursive: true })

    const filename = 'user_avatar_legacy.png'
    await fs.writeFile(path.join(vaultDir, filename), 'avatar-bytes')

    mockPathService.getUserAvatarsDirectory.mockResolvedValue(globalDir)
    mockPathService.getAvatarsDirectory.mockResolvedValue(vaultDir)

    const resolved = await service.resolveAvatarPath(`avatars/${filename}`)
    expect(resolved).toContain(filename)
    expect(existsSync(path.join(globalDir, filename))).toBe(true)

    await fs.rm(path.join(vaultDir, filename))
    const fromGlobal = await service.resolveAvatarPath(`avatars/${filename}`)
    expect(fromGlobal).toMatch(/user-avatars/i)
  })
})
