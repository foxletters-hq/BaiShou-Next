import { describe, it, expect, beforeEach } from 'vitest';
import { VaultIndexServiceImpl } from '../vault-index.service';
import { DiaryMeta } from '@baishou/shared';

describe('VaultIndexService', () => {
  let service: VaultIndexServiceImpl;

  beforeEach(() => {
    service = new VaultIndexServiceImpl();
  });

  const createMeta = (id: number, dateStr: string): DiaryMeta => ({
    id,
    date: new Date(dateStr),
    preview: `Preview ${id}`,
    tags: [],
  });

  it('should initialize empty', () => {
    expect(service.getAll()).toEqual([]);
  });

  it('should insert items and sort by date descending then id descending', () => {
    service.upsert(createMeta(1, '2026-03-21T00:00:00Z'));
    service.upsert(createMeta(3, '2026-03-23T00:00:00Z')); // latest
    service.upsert(createMeta(2, '2026-03-21T00:00:00Z')); // same date as 1, but id is larger

    const items = service.getAll();
    expect(items).toHaveLength(3);
    expect(items[0].id).toBe(3);
    expect(items[1].id).toBe(2);
    expect(items[2].id).toBe(1);
  });

  it('should update existing item instead of creating duplication', () => {
    service.upsert(createMeta(1, '2026-03-21T00:00:00Z'));
    const updatedMeta = createMeta(1, '2026-03-21T00:00:00Z');
    updatedMeta.preview = 'Updated Preview';
    service.upsert(updatedMeta);

    const items = service.getAll();
    expect(items).toHaveLength(1);
    expect(items[0].preview).toBe('Updated Preview');
  });

  it('should remove item by id', () => {
    service.upsert(createMeta(1, '2026-03-21T00:00:00Z'));
    service.upsert(createMeta(2, '2026-03-22T00:00:00Z'));

    service.remove(1);
    const items = service.getAll();
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe(2);
  });

  it('should clear all items', () => {
    service.upsert(createMeta(1, '2026-03-21T00:00:00Z'));
    service.clear();
    expect(service.getAll()).toHaveLength(0);
  });
});
