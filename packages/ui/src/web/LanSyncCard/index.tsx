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

const FIXED_POSITIONS = [
  { top: '20%', left: '20%' },
  { top: '30%', left: '75%' },
  { top: '75%', left: '50%' },
  { top: '65%', left: '15%' },
  { top: '80%', left: '80%' },
  { top: '15%', left: '50%' }
];

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
        <div className={styles.titleRow}>
          <h3 className={styles.title}>跨端局域网双向快传 (LAN Sync)</h3>
          <div className={`${styles.statusDot} ${isActive ? styles.activeDot : ''}`}></div>
        </div>
        <p className={styles.subtitle}>
          无需耗费外网流量即可将庞大的备份从电脑推向移动哨站。
        </p>
      </div>

      <div className={styles.radarZone}>
        {isActive && (
          <div className={styles.radarRings}>
            <div className={`${styles.ring} ${styles.ring1}`}></div>
            <div className={`${styles.ring} ${styles.ring2}`}></div>
            <div className={`${styles.ring} ${styles.ring3}`}></div>
          </div>
        )}

        <div className={`${styles.radarCore} ${isActive ? styles.corePulse : ''}`}>
           <span className={styles.coreIcon}>🛰️</span>
        </div>

        {!isActive && (
          <div className={styles.silentHint}>
             <span className={styles.silentIcon}>📡</span>
             <p>雷达处于静默休眠状态。</p>
          </div>
        )}

        {isActive && devices.length === 0 && (
          <div className={styles.scanHint}>
            正在不间断搜寻子网域中的白守节点...
          </div>
        )}

        {isActive && devices.map((d, index) => {
          const pos = FIXED_POSITIONS[index % FIXED_POSITIONS.length];
          const isSending = sendingTo === d.rawServiceId;
          return (
            <div 
              key={d.rawServiceId} 
              className={`${styles.deviceBubble} ${isSending ? styles.bubbleSending : ''}`}
              style={{ top: pos.top, left: pos.left }}
            >
              <div className={styles.bubbleIcon}>
                {d.deviceType === 'mobile' ? '📱' : '💻'}
              </div>
              <div className={styles.bubbleInfo}>
                <span className={styles.bubbleName} title={d.nickname}>{d.nickname}</span>
                <span className={styles.bubbleIp}>{d.ip}</span>
              </div>
              
              <button 
                className={styles.sendOverlayBtn}
                disabled={sendingTo !== null}
                onClick={(e) => { e.stopPropagation(); handleSend(d); }}
              >
                {isSending ? `${progress}%` : '推入快传'}
              </button>
            </div>
          )
        })}
      </div>

      <div className={styles.actionsBox}>
         <button 
           className={`${styles.controlBtn} ${isActive ? styles.stopBtn : styles.startBtn}`} 
           onClick={toggleDualMode}
         >
           {isActive ? '关闭全频段探测' : '雷达点火引擎 (发现与侦听本机)'}
         </button>
      </div>
    </div>
  );
};
