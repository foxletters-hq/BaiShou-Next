import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

import { DatabaseConnectionManager } from '../connection.manager';
import { DatabaseConnectionError, DatabaseNotConnectedError } from '../connection.manager.types';

describe('DatabaseConnectionManager', () => {
  let manager: DatabaseConnectionManager;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'baishou-test-db-'));
    manager = new DatabaseConnectionManager();
  });

  afterEach(async () => {
    if (manager.isConnected()) {
      await manager.disconnect();
    }
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (e) {
      // ignore
    }
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should not be connected initially', () => {
      expect(manager.isConnected()).toBe(false);
      expect(manager.getCurrentPath()).toBeNull();
    });

    it('should throw DatabaseNotConnectedError when getDb is called before connect', () => {
      expect(() => manager.getDb()).toThrow(DatabaseNotConnectedError);
    });
  });

  describe('connect() & disconnect()', () => {
    it('should successfully connect to a valid path', async () => {
      const dbPath = path.join(tempDir, 'test1.db');
      const db = await manager.connect(dbPath);
      
      expect(manager.isConnected()).toBe(true);
      expect(manager.getCurrentPath()).toBe(dbPath);
      expect(db).toBeDefined();
      expect(manager.getDb()).toBe(db);
      
      // Since we expect it to load sqlite-vec, vector related queries should work
      // But for basic unit test, verifying the drizzle instance exists is enough
    });

    it('should successfully disconnect and clean up resources', async () => {
      const dbPath = path.join(tempDir, 'test2.db');
      await manager.connect(dbPath);
      expect(manager.isConnected()).toBe(true);
      
      await manager.disconnect();
      expect(manager.isConnected()).toBe(false);
      expect(manager.getCurrentPath()).toBeNull();
      expect(() => manager.getDb()).toThrow(DatabaseNotConnectedError);
    });

    it('should safely handle disconnect when not connected', async () => {
      await expect(manager.disconnect()).resolves.not.toThrow();
    });

    it('should safely reconnect to a new path (hot swap)', async () => {
      const dbPath1 = path.join(tempDir, 'vault1.db');
      const dbPath2 = path.join(tempDir, 'vault2.db');

      await manager.connect(dbPath1);
      expect(manager.getCurrentPath()).toBe(dbPath1);

      // connect to new path directly without manually disconnecting
      await manager.connect(dbPath2);
      expect(manager.getCurrentPath()).toBe(dbPath2);
      expect(manager.isConnected()).toBe(true);
      
      // Confirm the old file is freed by ensuring we can delete it or checking instance change
      // Here we just test the abstraction
      const currentDb = manager.getDb();
      expect(currentDb).toBeDefined();
    });
  });

  describe('Lifecycle Events', () => {
    it('should trigger onConnect listeners when connecting', async () => {
      const dbPath = path.join(tempDir, 'events.db');
      const connectListener = vi.fn();
      
      manager.onConnect(connectListener);
      
      const db = await manager.connect(dbPath);
      
      expect(connectListener).toHaveBeenCalledTimes(1);
      expect(connectListener).toHaveBeenCalledWith(db, dbPath);
    });

    it('should trigger onDisconnect listeners when disconnecting', async () => {
      const dbPath = path.join(tempDir, 'events2.db');
      const disconnectListener = vi.fn();
      
      await manager.connect(dbPath);
      manager.onDisconnect(disconnectListener);
      
      await manager.disconnect();
      
      expect(disconnectListener).toHaveBeenCalledTimes(1);
    });

    it('should trigger both disconnect and connect on hot swap', async () => {
      const dbPath1 = path.join(tempDir, 'hotswap1.db');
      const dbPath2 = path.join(tempDir, 'hotswap2.db');
      const connectListener = vi.fn();
      const disconnectListener = vi.fn();

      manager.onConnect(connectListener);
      manager.onDisconnect(disconnectListener);

      await manager.connect(dbPath1);
      expect(connectListener).toHaveBeenCalledTimes(1);

      await manager.connect(dbPath2);
      // It should disconnect path1, then connect path2
      expect(disconnectListener).toHaveBeenCalledTimes(1);
      expect(connectListener).toHaveBeenCalledTimes(2);
      expect(connectListener).toHaveBeenLastCalledWith(expect.anything(), dbPath2);
    });
    
    it('should allow unsubscribing from events', async () => {
      const dbPath = path.join(tempDir, 'unsub.db');
      const connectListener = vi.fn();
      const off = manager.onConnect(connectListener);
      
      off(); // Unsubscribe
      await manager.connect(dbPath);
      
      expect(connectListener).not.toHaveBeenCalled();
    });
  });
});
