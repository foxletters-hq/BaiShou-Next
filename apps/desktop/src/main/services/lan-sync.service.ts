import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as http from 'http';
import { app } from 'electron';
import express from 'express';
import { Bonjour, Browser } from 'bonjour-service';
import { v4 as uuidv4 } from 'uuid';

import { ILanSyncService, DiscoveredDevice, IArchiveService } from '@baishou/core';

export class DesktopLanSyncService implements ILanSyncService {
  private server: http.Server | null = null;
  private bonjour: Bonjour | null = null;
  private browser: Browser | null = null;
  private publishedService: any = null;
  
  private fileReceivedCallback?: (path: string) => void;

  constructor(private archiveService: IArchiveService) {
    // Only used to generate archive zip internally for sending
  }

  private getLocalIps(): string[] {
    const ifs = os.networkInterfaces();
    const ips: string[] = [];
    for (const name of Object.keys(ifs)) {
      for (const iface of ifs[name]!) {
        // v4 only, not internal
        if (iface.family === 'IPv4' && !iface.internal) {
          ips.push(iface.address);
        }
      }
    }
    return ips;
  }

  public async startBroadcasting(): Promise<{ ip: string; port: number } | null> {
    if (this.server) return null; // already running

    const ips = this.getLocalIps();
    if (ips.length === 0) throw new Error('No local network connection found');

    const expressApp = express();

    // Endpoints
    expressApp.get('/info', (req, res) => {
      // Return same schema as mobile and original expectation
      res.json({ nickname: os.userInfo().username || 'Desktop User' });
    });

    expressApp.post('/upload', (req, res) => {
      const fileName = `received_lan_${Date.now()}.zip`;
      const tempPath = path.join(app.getPath('temp'), fileName);
      const writeStream = fs.createWriteStream(tempPath);

      req.pipe(writeStream);

      req.on('end', () => {
        // 网络请求结束，等待文件流彻底刷入磁盘
        writeStream.end();
      });

      writeStream.on('finish', () => {
        // 此时写入进程正式完成关停，并解除文件句柄占用，可安全进行解压
        if (this.fileReceivedCallback) {
          this.fileReceivedCallback(tempPath);
        }
        res.status(200).send('Success');
      });

      req.on('error', (err) => {
        console.error('Failed to receive LAN stream', err);
        res.status(500).send('Stream error');
      });
    });

    return new Promise((resolve, reject) => {
      // Listens on random open port 0
      this.server = expressApp.listen(0, '0.0.0.0', () => {
        const addr = this.server?.address();
        if (addr && typeof addr !== 'string') {
          const port = addr.port;
          const displayIp = ips[0];
          
          // Start mDNS
          try {
            this.bonjour = new Bonjour();
            
            const rawNickname = os.userInfo().username || 'Desktop';
            const safeNickname = rawNickname.replace(/[^\w\u4e00-\u9fa5]/g, '').substring(0, 10);
            const serviceName = `BaiShou-${safeNickname}-${uuidv4().substring(0,4)}`;
            
            this.publishedService = this.bonjour.publish({
              name: serviceName,
              type: 'baishou', // translates to _baishou._tcp
              protocol: 'tcp',
              port: port,
              txt: {
                nickname: safeNickname,
                ip: ips.slice(0, 4).join(','),
                device_type: 'desktop'
              }
            });
            resolve({ ip: displayIp, port });
          } catch(e) {
            this.stopBroadcasting();
            reject(e);
          }
        } else {
          this.stopBroadcasting();
          reject(new Error('Failed to bind server address'));
        }
      });
    });
  }

  public async stopBroadcasting(): Promise<void> {
    if (this.publishedService) {
      this.publishedService.stop();
      this.publishedService = null;
    }
    if (this.bonjour) {
      this.bonjour.destroy();
      this.bonjour = null;
    }
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }

  public async startDiscovery(
    onDeviceFound: (device: DiscoveredDevice) => void,
    onDeviceLost: (deviceId: string) => void
  ): Promise<void> {
    if (!this.bonjour) {
      this.bonjour = new Bonjour();
    }
    
    this.browser = this.bonjour.find({ type: 'baishou' }, (service) => {
      try {
        const records = service.txt as any;
        const device: DiscoveredDevice = {
          nickname: records?.nickname || service.name,
          ip: (records?.ip || '').split(',')[0] || service.addresses?.[0] || 'Unknown',
          port: service.port,
          deviceType: records?.device_type || 'other',
          rawServiceId: service.name
        };
        onDeviceFound(device);
      } catch (e) {
        console.error('Failed to parse mDNS txt string', e);
      }
    });

    this.browser.on('down', (service) => {
      onDeviceLost(service.name);
    });
  }

  public async stopDiscovery(): Promise<void> {
    if (this.browser) {
      this.browser.stop();
      this.browser = null;
    }
    // We only destroy Bonjour if not broadcasting either
    if (!this.publishedService && this.bonjour) {
      this.bonjour.destroy();
      this.bonjour = null;
    }
  }

  public async sendFile(ip: string, port: number, onProgress?: (percent: number) => void): Promise<boolean> {
    return new Promise(async (resolve, reject) => {
      try {
        const zipFile = await this.archiveService.exportToTempFile();
        if (!zipFile) {
          resolve(false);
          return;
        }

        const stat = await fsp.stat(zipFile);
        const readStream = fs.createReadStream(zipFile);

        const options = {
          hostname: ip,
          port: port,
          path: '/upload',
          method: 'POST',
          headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Length': stat.size,
            'Content-Disposition': `attachment; filename="${path.basename(zipFile)}"`
          }
        };

        const req = http.request(options, (res) => {
          let body = '';
          res.on('data', d => body += d);
          res.on('end', () => {
            if (res.statusCode === 200) {
              resolve(true);
            } else {
              resolve(false);
            }
          });
        });

        req.on('error', (e) => {
          console.error('[DesktopLanSyncService] POST error: ', e);
          resolve(false);
        });

        if (onProgress) {
          let uploaded = 0;
          readStream.on('data', (chunk) => {
            uploaded += chunk.length;
            onProgress(Math.min(100, Math.round((uploaded / stat.size) * 100)));
          });
        }

        readStream.pipe(req);

      } catch (e) {
        console.error('[DesktopLanSyncService] failed to send file', e);
        resolve(false);
      }
    });
  }

  public onFileReceived(callback: (zipFilePath: string) => void): void {
    this.fileReceivedCallback = callback;
  }
}
