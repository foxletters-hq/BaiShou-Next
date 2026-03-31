import * as Network from 'expo-network';
import Zeroconf from 'react-native-zeroconf';
import * as FileSystem from 'expo-file-system';
import { IArchiveService, ILanSyncService, DiscoveredDevice } from '@baishou/core';

// We import our custom internal module!
import * as BaishouServer from '../../modules/expo-baishou-server';

export class MobileLanSyncService implements ILanSyncService {
  private zeroconf: Zeroconf;
  private isBroadcasting = false;
  private currentPort = 0;
  private currentIp = '';
  private fileReceivedCallback?: (path: string) => void;
  private deviceFoundCb?: (d: DiscoveredDevice) => void;
  private deviceLostCb?: (d: string) => void;
  private serverEventSub: any;

  constructor(private archiveService: IArchiveService) {
    this.zeroconf = new Zeroconf();
    
    this.zeroconf.on('resolved', (service: any) => {
      if (!this.deviceFoundCb) return;
      try {
        const records = service.txt || {};
        const device: DiscoveredDevice = {
          nickname: records.nickname || service.name,
          ip: service.host || records.ip?.split(',')[0] || service.addresses?.[0] || 'Unknown',
          port: service.port,
          deviceType: records.device_type || 'other',
          rawServiceId: service.name
        };
        this.deviceFoundCb(device);
      } catch (e) {
        console.warn('Zeroconf parse error', e);
      }
    });

    this.zeroconf.on('remove', (serviceName: string) => {
      if (this.deviceLostCb) this.deviceLostCb(serviceName);
    });
  }

  public async startBroadcasting(): Promise<{ ip: string; port: number } | null> {
    if (this.isBroadcasting) return { ip: this.currentIp, port: this.currentPort };

    const ip = await Network.getIpAddressAsync();
    if (!ip || ip === '0.0.0.0') throw new Error('No local IPv4 found');

    // Start Native Server on random port 0!
    // The native module will bind and return the actual port
    this.currentPort = BaishouServer.startServer(0);
    if (this.currentPort <= 0) {
      throw new Error('Failed to start native NanoHTTPD server');
    }

    this.currentIp = ip;
    
    // Register event listener from Native Module
    if (this.serverEventSub) this.serverEventSub.remove();
    this.serverEventSub = BaishouServer.onFileReceived((event) => {
      if (this.fileReceivedCallback) {
        this.fileReceivedCallback(event.path);
      }
    });

    // Publish mDNS
    const safeNickname = 'BaishouMob';
    const uuid = Math.floor(Math.random() * 10000).toString();
    const serviceName = `BaiShou-${safeNickname}-${uuid}`;

    this.zeroconf.publish(serviceName, 'tcp', 'baishou', 'local.', this.currentPort, {
      nickname: safeNickname,
      ip: ip,
      device_type: 'mobile'
    });

    this.isBroadcasting = true;
    return { ip, port: this.currentPort };
  }

  public async stopBroadcasting(): Promise<void> {
    if (!this.isBroadcasting) return;
    this.zeroconf.unpublishService('baishou');
    BaishouServer.stopServer();
    if (this.serverEventSub) {
      this.serverEventSub.remove();
      this.serverEventSub = null;
    }
    this.isBroadcasting = false;
  }

  public async startDiscovery(
    onDeviceFound: (device: DiscoveredDevice) => void,
    onDeviceLost: (deviceId: string) => void
  ): Promise<void> {
    this.deviceFoundCb = onDeviceFound;
    this.deviceLostCb = onDeviceLost;
    this.zeroconf.scan('baishou', 'tcp', 'local.');
  }

  public async stopDiscovery(): Promise<void> {
    this.zeroconf.stop();
    this.deviceFoundCb = undefined;
    this.deviceLostCb = undefined;
  }

  public async sendFile(ip: string, port: number, onProgress?: (percent: number) => void): Promise<boolean> {
    try {
      const zipPath = await this.archiveService.exportToTempFile();
      if (!zipPath) return false;

      // In React Native Expo, we use FileSystem.uploadAsync for multipart or raw POST!
      const url = `http://${ip}:${port}/upload`;
      
      const response = await FileSystem.uploadAsync(url, zipPath, {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      });

      // Cleanup
      await FileSystem.deleteAsync(zipPath, { idempotent: true }).catch(()=>{});

      return response.status === 200;
    } catch (e) {
      console.error('[MobileLanSyncService] failed to push file', e);
      return false;
    }
  }

  public onFileReceived(callback: (zipFilePath: string) => void): void {
    this.fileReceivedCallback = callback;
  }
}
