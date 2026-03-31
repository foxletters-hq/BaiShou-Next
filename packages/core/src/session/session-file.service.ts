import fs from 'node:fs/promises';
import path from 'node:path';
import { IStoragePathService } from '../vault/storage-path.types';

export class SessionFileService {
  constructor(private readonly pathProvider: IStoragePathService) {}

  private async getDirectory(): Promise<string> {
    const targetDir = await this.pathProvider.getSessionsBaseDirectory();
    await fs.mkdir(targetDir, { recursive: true });
    return targetDir;
  }

  async writeSession(sessionId: string, sessionData: any): Promise<string> {
     const dir = await this.getDirectory();
     const fullPath = path.join(dir, `${sessionId}.json`);
     // format with 2 spaces for human-readable diff potential in webdav
     await fs.writeFile(fullPath, JSON.stringify(sessionData, null, 2), 'utf8');
     return fullPath;
  }

  async readSession(sessionId: string): Promise<any | null> {
     const dir = await this.getDirectory();
     const fullPath = path.join(dir, `${sessionId}.json`);
     try {
       const content = await fs.readFile(fullPath, 'utf8');
       return JSON.parse(content);
     } catch (e: any) {
       if (e.code === 'ENOENT') return null;
       throw e;
     }
  }

  async deleteSession(sessionId: string): Promise<void> {
     const dir = await this.getDirectory();
     const fullPath = path.join(dir, `${sessionId}.json`);
     try {
       await fs.unlink(fullPath);
     } catch (e: any) {
       if (e.code !== 'ENOENT') throw e;
     }
  }

  async listAllSessions(): Promise<{ id: string, fullPath: string }[]> {
     const dir = await this.getDirectory();
     let files: string[] = [];
     try {
        files = await fs.readdir(dir);
     } catch (e: any) {
        if (e.code !== 'ENOENT') return [];
        throw e;
     }

     const results: { id: string, fullPath: string }[] = [];
     for (const f of files) {
        if (!f.endsWith('.json')) continue;
        const id = f.slice(0, -5); // remove .json
        results.push({ id, fullPath: path.join(dir, f) });
     }
     return results;
  }
}
