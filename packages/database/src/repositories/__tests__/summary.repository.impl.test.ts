import { describe, it, expect, beforeEach } from 'vitest';
import { SummaryRepositoryImpl } from '../summary.repository.impl';
import { db } from '../../index';
import { summariesTable } from '../../schema/summaries';
import { SummaryType } from '@baishou/shared';

describe('SummaryRepositoryImpl', () => {
  let repo: SummaryRepositoryImpl;

  beforeEach(async () => {
    // 假设测试环境内存数据库或者每次清洗表
    await db.delete(summariesTable);
    repo = new SummaryRepositoryImpl();
  });

  const startDate = new Date('2026-03-01T00:00:00.000Z');
  const endDate = new Date('2026-03-31T23:59:59.000Z');

  it('should save a summary successfully', async () => {
    const summary = await repo.save({
      type: 'monthly',
      startDate,
      endDate,
      content: 'Monthly summary test content.'
    });

    expect(summary).toBeDefined();
    expect(summary.id).toBeGreaterThan(0);
    expect(summary.content).toBe('Monthly summary test content.');
  });

  it('should update a specific summary by id', async () => {
    const saved = await repo.save({
      type: 'weekly',
      startDate,
      endDate,
      content: 'Initial config'
    });

    const updated = await repo.update(saved.id!, {
      content: 'Updated config'
    });

    expect(updated.id).toBe(saved.id);
    expect(updated.content).toBe('Updated config');
  });

  it('should get summary by date range correctly', async () => {
    await repo.save({
      type: 'monthly',
      startDate,
      endDate,
      content: 'Range test'
    });

    const result = await repo.getByDateRange('monthly', startDate, endDate);
    expect(result).toBeDefined();
    expect(result!.content).toBe('Range test');

    const notExist = await repo.getByDateRange('weekly', startDate, endDate);
    expect(notExist).toBeNull();
  });

  it('should get combined list of summaries starting at optionally date', async () => {
    const futureStart = new Date('2026-04-01T00:00:00.000Z');
    
    await repo.save({ type: 'weekly', startDate, endDate, content: 'A' });
    await repo.save({ type: 'weekly', startDate: futureStart, endDate: new Date('2026-04-07T23:59:59.000Z'), content: 'B' });

    const all = await repo.getSummaries();
    expect(all.length).toBe(2);

    const filtered = await repo.getSummaries({ start: futureStart });
    expect(filtered.length).toBe(1);
    expect(filtered[0].content).toBe('B');
  });

  it('should delete a summary by its numeric id safely', async () => {
    const item = await repo.save({ type: 'yearly', startDate, endDate, content: 'C' });
    await repo.delete(item.id!);
    const check = await repo.getSummaries();
    expect(check.length).toBe(0);
  });
});
