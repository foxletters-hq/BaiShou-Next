import { describe, it, expect, vi } from 'vitest';
import { detectVecSupport } from '../vec-capability';

describe('detectVecSupport', () => {
  it('should return available: true when query succeeds', async () => {
    const mockDb = {
      execute: vi.fn().mockResolvedValue(undefined)
    };

    const capability = await detectVecSupport(mockDb);

    expect(capability.available).toBe(true);
    expect(capability.reason).toBeUndefined();
    expect(mockDb.execute).toHaveBeenCalledWith('SELECT vec_version()');
  });

  it('should return available: false when query throws error', async () => {
    const mockDb = {
      execute: vi.fn().mockRejectedValue(new Error('no such function: vec_version'))
    };

    const capability = await detectVecSupport(mockDb);

    expect(capability.available).toBe(false);
    expect(capability.reason).toContain('no such function');
  });
});
