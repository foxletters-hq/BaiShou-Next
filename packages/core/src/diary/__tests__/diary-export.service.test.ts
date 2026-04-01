import { describe, it, expect } from 'vitest';
import { DiaryExportServiceImpl } from '../diary-export.service';
import { Diary } from '@baishou/shared';

describe('DiaryExportService', () => {
  const service = new DiaryExportServiceImpl();

  const diaries: Diary[] = [
    {
      id: 1,
      date: new Date('2026-03-01T10:00:00Z'),
      content: 'Happy March!',
      tags: 'march,happy',
      createdAt: new Date(),
      updatedAt: new Date(),
      isFavorite: false,
      mediaPaths: []
    },
    {
      id: 2,
      date: new Date('2026-03-02T10:00:00Z'),
      content: 'Another day.',
      tags: '',
      createdAt: new Date(),
      updatedAt: new Date(),
      isFavorite: false,
      mediaPaths: []
    }
  ];

  it('should format diaries to JSON properly', async () => {
    const buffer = await service.export(diaries, { format: 'json' });
    const jsonStr = buffer.toString('utf-8');
    const parsed = JSON.parse(jsonStr);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].content).toBe('Happy March!');
  });

  it('should format diaries to Markdown string conforming to dart code', async () => {
    const buffer = await service.export(diaries, { format: 'md' });
    const mdStr = buffer.toString('utf-8');
    
    // Check Markdown generated string containing headers and tags
    expect(mdStr).toContain('## 2026-03-01');
    expect(mdStr).toContain('#march #happy');
    expect(mdStr).toContain('Happy March!');
    expect(mdStr).toContain('## 2026-03-02');
  });

  it('should format diaries to plain text', async () => {
    const buffer = await service.export(diaries, { format: 'txt' });
    const txtStr = buffer.toString('utf-8');
    
    expect(txtStr).toContain('2026-03-01\n'); // Text mode usually skips markdown hashes
    expect(txtStr).toContain('Happy March!');
  });
});
