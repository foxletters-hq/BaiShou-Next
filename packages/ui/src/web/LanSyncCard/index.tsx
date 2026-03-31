import React, { useState, useEffect } from 'react';
import styles from './LanSyncCard.module.css';

export interface DiscoveredDevice {
  nickname: string;
  ip: string;
  port: number;
  deviceType: 'mobile' | 'desktop' | 'other';
  rawServiceId: string;
}

export interface LanSyncCardProps {
  onStartBroadcasting: () => Promise<{ ip: string; port: number } | null>;
  onStopBroadcasting: () => Promise<void>;
  onStartDiscovery: (
    onDeviceFound: (device: DiscoveredDevice) => void,
    onDeviceLost: (deviceId: string) => void
  ) => Promise<void>;
  onStopDiscovery: () => Promise<void>;
  onSendFile: (ip: string, port: number, onProgress: (p: number) => void) => Promise<boolean>;
  onFileReceivedListener?: (callback: (zipPath: string) => void) => () => void;
  onImportZip?: (filePath: string) => Promise<void>;
}

export const LanSyncCard: React.FC<LanSyncCardProps> = ({
  onStartBroadcasting,
  onStopBroadcasting,
  onStartDiscovery,
  onStopDiscovery,
  onSendFile,
  onFileReceivedListener,
  onImportZip
}) => {
  const [isActive, setIsActive] = useState(false);
  const [devices, setDevices] = useState<DiscoveredDevice[]>([]);
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (onFileReceivedListener && onImportZip) {
      const unsub = onFileReceivedListener((zipPath) => {
        const confirmText = window.prompt(
          '【局域网快传接收】\n您收到了一个全量备份包，是否立即挂载并覆盖本地数据库？\n请输入 "CONFIRM" 确认：'
        );
        if (confirmText === 'CONFIRM') {
          onImportZip(zipPath).then(() => {
            alert('导入成功，应用即将重载');
            window.location.reload();
          }).catch(console.error);
        } else {
          alert('已取消接收与挂载');
        }
      });
      return unsub;
    }
    return undefined;
  }, [onFileReceivedListener, onImportZip]);

  const toggleDualMode = async () => {
    if (isActive) {
      await onStopDiscovery();
      await onStopBroadcasting();
      setIsActive(false);
      setDevices([]);
    } else {
      await onStartBroadcasting();
      await onStartDiscovery(
        (dev) => setDevices(prev => {
          const idx = prev.findIndex(d => d.rawServiceId === dev.rawServiceId);
          if (idx !== -1) return prev;
          return [...prev, dev];
        }),
        (id) => setDevices(prev => prev.filter(d => d.rawServiceId !== id))
      );
      setIsActive(true);
    }
  };

  const handleSend = async (device: DiscoveredDevice) => {
    setSendingTo(device.rawServiceId);
    setProgress(0);
    const success = await onSendFile(device.ip, device.port, (p) => setProgress(p));
    setSendingTo(null);
    if (success) {
      alert(`已成功静默推送到 ${device.nickname}`);
    } else {
      alert(`发送至 ${device.nickname} 失败，可能对端已掉线或文件过大超时。`);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>跨端局域网双向快传 (LAN Sync)</h3>
        <p className={styles.subtitle}>
          无需耗费外网流量即可将庞大的备份从电脑推向手机。开启雷达后将同时激活发现与接收服务。
        </p>
      </div>

      <div className={styles.actions}>
         <button 
           className={isActive ? styles.stopBtn : styles.startBtn} 
           onClick={toggleDualMode}
         >
           {isActive ? '关闭局域网雷达' : '全频段雷达点火 (寻找并接收)'}
         </button>
      </div>

      {isActive && (
        <div className={styles.radarZone}>
          <h4 className={styles.radarTitle}>雷达发现设备 ({devices.length})</h4>
          {devices.length === 0 ? <p className={styles.loading}>📡 扫描中...</p> : (
            <div className={styles.deviceList}>
              {devices.map(d => (
                <div key={d.rawServiceId} className={styles.deviceCard}>
                  <div>
                    <div className={styles.deviceName}>{d.nickname} ({d.deviceType})</div>
                    <div className={styles.deviceIp}>{d.ip}:{d.port}</div>
                  </div>
                  <button 
                    disabled={sendingTo !== null}
                    onClick={() => handleSend(d)}
                    className={styles.sendBtn}
                  >
                    {sendingTo === d.rawServiceId ? `推送中 ${progress}%` : '推入快传'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
