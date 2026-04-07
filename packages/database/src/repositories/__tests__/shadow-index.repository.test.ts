import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ShadowIndexConnectionManager } from '../../shadow-index.connection.manager';
import { ShadowIndexRepository, UpsertShadowIndexPayload } from '../shadow-index.repository';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

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
});

describe('ShadowIndexRepository', () => {
  let manager: ShadowIndexConnectionManager;
  let repo: ShadowIndexRepository;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'baishou-shadowrepo-test-'));
    manager = new ShadowIndexConnectionManager();
    await manager.connect(tempDir);
    repo = new ShadowIndexRepository(manager.getDb());
  });

  afterEach(async () => {
    await manager.disconnect();
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (e) {
      // ignore
    }
  });

  describe('Diary Upsert & Retrieval', () => {
    it('upsert correctly inserts a new diary metadata and fulltext index', async () => {
      const dateIso = '2026-04-06T12:00:00.000Z';
      const dto = generateDummyPayload(dateIso, 'Hello world! Today I am testing search capability.');

      await repo.upsert(dto);

      const records = await repo.getAllRecords();
      expect(records).toHaveLength(1);
      expect(records[0].filePath).toBe(dto.filePath);
      expect(records[0].date).toBe(dateIso); 
    });

    it('findByDate identifies standard daily note', async () => {
      const dateIso = '2026-04-07T12:00:00.000Z';
      await repo.upsert(generateDummyPayload(dateIso, 'content for April 7'));

      const found = await repo.findByDate(dateIso);
      expect(found).toBeDefined();
      expect(found!.date).toBe(dateIso);
    });

    it('upsert correctly overrides an existing diary block with the same id tracking', async () => {
       const dateIso = '2026-04-08T12:00:00.000Z';
       
       await repo.upsert(generateDummyPayload(dateIso, 'first text'));
       const initialId = (await repo.findByDate(dateIso))!.id;

       await repo.upsert(generateDummyPayload(dateIso, 'second text'));

       const count = await repo.count();
       expect(count).toBe(1); 

       const updated = await repo.findByDate(dateIso);
       expect(updated!.id).toBe(initialId);
    });
  });

  describe('Full Text Search (FTS5)', () => {
    it('searchFTS handles basic token matching correctly', async () => {
      await repo.upsert(generateDummyPayload('2026-01-01T00:00:00.000Z', 'Alpha Beta Gamma'));
      await repo.upsert(generateDummyPayload('2026-01-02T00:00:00.000Z', 'Delta Epsilon Zeta'));

      const results = await repo.searchFTS('Beta');
      expect(results).toHaveLength(1);
      
      // FTS snippet contains <b> tags out of the box because of snippet(..., '<b>', '</b>')
      expect(results[0].contentSnippet).toContain('<b>Beta</b>');
    });

    it('searchFTS gracefully returns empty arrays for garbage queries', async () => {
      await repo.upsert(generateDummyPayload('2026-01-03T00:00:00.000Z', 'something normal'));
      
      const res = await repo.searchFTS('?@!$&*()_++');
      expect(res).toBeInstanceOf(Array);
      expect(res).toHaveLength(0);
    });
  });

  describe('Deletion', () => {
    it('deleteById correctly cascades removal of main record and fts row', async () => {
      const dateIso = '2026-01-04T00:00:00.000Z';
      await repo.upsert(generateDummyPayload(dateIso, 'delete me now'));
      
      const record = await repo.findByDate(dateIso);
      expect(record).toBeDefined();

      await repo.deleteById(record!.id);

      const afterDel = await repo.findByDate(dateIso);
      expect(afterDel).toBeNull();
      
      const ftsRes = await repo.searchFTS('delete');
      expect(ftsRes).toHaveLength(0);
    });
  });
});
