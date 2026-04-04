import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileSyncServiceImpl } from '../file-sync.service';
import { Diary } from '@baishou/shared';
import * as fs from 'fs';
import * as path from 'path';

describe('FileSyncService', () => {
  const rootPath = path.join(__dirname, '.test_diaries');
  let service: FileSyncServiceImpl;

  beforeEach(() => {
    service = new FileSyncServiceImpl({ getJournalsBaseDirectory: async () => rootPath } as any);
    if (fs.existsSync(rootPath)) {
      fs.rmSync(rootPath, { recursive: true, force: true });
    }
    fs.mkdirSync(rootPath, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(rootPath)) {
      fs.rmSync(rootPath, { recursive: true, force: true });
    }
  });

  const sampleDiary: Diary = {
    id: 1,
    date: new Date('2026-03-24T12:00:00Z'),
    content: 'My test file sync diary content.',
    tags: 'test,sync',
    createdAt: new Date(),
    updatedAt: new Date('2026-03-24T12:30:00Z'),
    isFavorite: true,
    mediaPaths: []
  };

  it('should write a newly created diary to the expected markdown path', async () => {
    await service.writeJournal(sampleDiary);

    const year = sampleDiary.date.getFullYear().toString();
    const month = (sampleDiary.date.getMonth() + 1).toString().padStart(2, '0');
    const day = sampleDiary.date.toISOString().split('T')[0];

    const expectedPath = path.join(rootPath, year, month, `${day}.md`);
    expect(fs.existsSync(expectedPath)).toBe(true);

    const content = fs.readFileSync(expectedPath, 'utf8');
    expect(content).toContain('id: 1');
    expect(content).toContain('date: 2026-03-24');
    expect(content).toContain('tags: [test, sync]');
    expect(content).toContain('My test file sync diary content.');
  });

  it('should read a previously written diary successfully', async () => {
    await service.writeJournal(sampleDiary);
    const readBack = await service.readJournal(sampleDiary.date);

    expect(readBack).toBeDefined();
    expect(readBack?.id).toBe(1);
    expect(readBack?.content).toBe('My test file sync diary content.');
    expect(readBack?.tags).toBe('test,sync');
    expect(readBack?.updatedAt?.getTime()).toBe(sampleDiary.updatedAt?.getTime());
  });

  it('should return null when reading an unexisting diary date', async () => {
    const readBack = await service.readJournal(new Date('2025-01-01T00:00:00Z'));
    expect(readBack).toBeNull();
  });

  it('should delete existing journal file successfully', async () => {
    await service.writeJournal(sampleDiary);
    await service.deleteJournalFile(sampleDiary.date);

    const readBack = await service.readJournal(sampleDiary.date);
    expect(readBack).toBeNull();
  });
});
