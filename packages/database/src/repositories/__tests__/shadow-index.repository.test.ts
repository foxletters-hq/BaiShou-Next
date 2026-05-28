import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ShadowIndexConnectionManager } from '../../shadow-index.connection.manager'
import { ShadowIndexRepository, UpsertShadowIndexPayload } from '../shadow-index.repository'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as os from 'node:os'

const generateDummyPayload = (dateIso: string, text: string): UpsertShadowIndexPayload => ({
  date: dateIso,
  createdAt: dateIso,
  updatedAt: dateIso,
  contentHash: `hash-${dateIso}`,
  isFavorite: false,
  hasMedia: false,
  rawContent: text,
  tags: '',
  filePath: `journals/${dateIso.split('T')[0]}.md`
})

describe('ShadowIndexRepository', () => {
  let manager: ShadowIndexConnectionManager
  let repo: ShadowIndexRepository
  let tempDir: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'baishou-shadowrepo-test-'))
    manager = new ShadowIndexConnectionManager()
    await manager.connect(tempDir)
    repo = new ShadowIndexRepository(manager.getDb())
  })

  afterEach(async () => {
    await manager.disconnect()
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch (e) {
      // ignore
    }
  })

  describe('Diary Upsert & Retrieval', () => {
    it('upsert correctly inserts a new diary metadata and fulltext index', async () => {
      const dateIso = '2026-04-06T12:00:00.000Z'
      const dto = generateDummyPayload(
        dateIso,
        'Hello world! Today I am testing search capability.'
      )

      await repo.upsert(dto)

      const records = await repo.getAllRecords()
      expect(records).toHaveLength(1)
      expect(records[0]!.filePath).toBe(dto.filePath)
      expect(records[0]!.date).toBe(dateIso)
    })

    it('findByDate identifies standard daily note', async () => {
      const dateIso = '2026-04-07T12:00:00.000Z'
      await repo.upsert(generateDummyPayload(dateIso, 'content for April 7'))

      const found = await repo.findByDate(dateIso)
      expect(found).toBeDefined()
      expect(found!.date).toBe(dateIso)
    })

    it('upsert correctly overrides an existing diary block with the same id tracking', async () => {
      const dateIso = '2026-04-08T12:00:00.000Z'

      await repo.upsert(generateDummyPayload(dateIso, 'first text'))
      const initialId = (await repo.findByDate(dateIso))!.id

      await repo.upsert(generateDummyPayload(dateIso, 'second text'))

      const count = await repo.count()
      expect(count).toBe(1)

      const updated = await repo.findByDate(dateIso)
      expect(updated!.id).toBe(initialId)
    })
  })

  describe('Full Text Search (FTS5)', () => {
    it('searchFTS handles basic token matching correctly', async () => {
      await repo.upsert(generateDummyPayload('2026-01-01T00:00:00.000Z', 'Alpha Beta Gamma'))
      await repo.upsert(generateDummyPayload('2026-01-02T00:00:00.000Z', 'Delta Epsilon Zeta'))

      const results = await repo.searchFTS('Beta')
      expect(results).toHaveLength(1)

      // FTS snippet contains <b> tags out of the box because of snippet(..., '<b>', '</b>')
      expect(results[0]!.contentSnippet).toContain('<b>Beta</b>')
    })

    it('searchFTS gracefully returns empty arrays for garbage queries', async () => {
      await repo.upsert(generateDummyPayload('2026-01-03T00:00:00.000Z', 'something normal'))

      const res = await repo.searchFTS('?@!$&*()_++')
      expect(res).toBeInstanceOf(Array)
      expect(res).toHaveLength(0)
    })

    it('searchFTS matches alphanumeric prefixes correctly (e.g. searching 1 matches 10)', async () => {
      await repo.upsert(generateDummyPayload('2026-01-04T00:00:00.000Z', 'Time is 10:35:30.'))

      const res = await repo.searchFTS('1')
      expect(res).toHaveLength(1)
      expect(res[0]!.contentSnippet).toContain('<b>10</b>:35:30')
    })

    it('searchFTS handles Chinese token matching and snippet cleanup correctly', async () => {
      await repo.upsert(
        generateDummyPayload('2026-01-10T00:00:00.000Z', '今天的天气真好，我爱写日记。')
      )
      await repo.upsert(generateDummyPayload('2026-01-11T00:00:00.000Z', '明天要下雨。'))

      // 1. 测试搜索“的”字
      const resultsOf = await repo.searchFTS('的')
      expect(resultsOf).toHaveLength(1)
      expect(resultsOf[0]!.contentSnippet).toContain('今天<b>的</b>天气')

      // 2. 测试搜索中文词组“天气”
      const resultsWeather = await repo.searchFTS('天气')
      expect(resultsWeather).toHaveLength(1)
      expect(resultsWeather[0]!.contentSnippet).toContain('今天的<b>天气</b>真好') // 空格被还原且支持高亮

      // 3. 测试搜索中文词组“日记”
      const resultsDiary = await repo.searchFTS('日记')
      expect(resultsDiary).toHaveLength(1)
      expect(resultsDiary[0]!.contentSnippet).toContain('我爱写<b>日记</b>')

      // 4. 验证 listAllWithFTS 不会被分词的空格破坏
      const list = await repo.listAllWithFTS()
      const match = list.find((item) => item.date === '2026-01-10T00:00:00.000Z')
      expect(match).toBeDefined()
      expect(match!.rawContent).toBe('今天的天气真好，我爱写日记。') // 无多余空格
    })

    it('searchFTS handles multi-word AND search and LIKE substring fallback correctly', async () => {
      await repo.upsert(
        generateDummyPayload('2026-02-01T00:00:00.000Z', '今天天气晴朗，Marcus 决定去打篮球。')
      )
      await repo.upsert(
        generateDummyPayload('2026-02-02T00:00:00.000Z', '明天可能要下雨，我们在家写代码。')
      )

      // 1. 多词非连续 AND 搜索："天气 篮球"
      const res1 = await repo.searchFTS('天气 篮球')
      expect(res1).toHaveLength(1)
      expect(res1[0]!.contentSnippet).toContain('天气')
      expect(res1[0]!.contentSnippet).toContain('篮球')

      // 2. 混合子串 LIKE 兜底匹配："rcu" (匹配 "Marcus" 子串，FTS 通常不支持纯子串，需要 LIKE 兜底)
      const res2 = await repo.searchFTS('rcu')
      expect(res2).toHaveLength(1)
      expect(res2[0]!.contentSnippet).toContain('Ma<b>rcu</b>s')

      // 3. 多词混合："代码 下雨"
      const res3 = await repo.searchFTS('代码 下雨')
      expect(res3).toHaveLength(1)
      expect(res3[0]!.contentSnippet).toContain('下雨')
      expect(res3[0]!.contentSnippet).toContain('代码')
    })
  })

  describe('Deletion', () => {
    it('deleteById correctly cascades removal of main record and fts row', async () => {
      const dateIso = '2026-01-04T00:00:00.000Z'
      await repo.upsert(generateDummyPayload(dateIso, 'delete me now'))

      const record = await repo.findByDate(dateIso)
      expect(record).toBeDefined()

      await repo.deleteById(record!.id)

      const afterDel = await repo.findByDate(dateIso)
      expect(afterDel).toBeNull()

      const ftsRes = await repo.searchFTS('delete')
      expect(ftsRes).toHaveLength(0)
    })
  })
})
