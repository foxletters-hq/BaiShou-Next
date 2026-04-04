import React, { useState, useEffect } from 'react';
import styles from './LanSyncCard.module.css';
import { useTranslation } from 'react-i18next';
import { useDialog } from '../Dialog';
import { useToast } from '../Toast/useToast';

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
  const { t } = useTranslation();
  const dialog = useDialog();
  const toast = useToast();
  const [isActive, setIsActive] = useState(false);
  const [devices, setDevices] = useState<DiscoveredDevice[]>([]);
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (onFileReceivedListener && onImportZip) {
      const unsub = onFileReceivedListener(async (zipPath) => {
        const confirmText = await dialog.prompt(
          t('lan.receive_confirm_msg', '【局域网快传接收】\n发现来自局域网设备传来的全量备份包，是否立即应用并覆盖本地数据库？\n请输入 "CONFIRM" 以确认覆盖：')
        );
        if (confirmText === 'CONFIRM') {
          onImportZip(zipPath).then(() => {
            toast.showSuccess('导入成功，应用即将重载');
            setTimeout(() => window.location.reload(), 1500);
          }).catch((e) => {
            console.error(e);
            toast.showError('重载导入失败');
          });
        } else {
          toast.show('已取消接收与挂载');
        }
      });
      return unsub;
    }
    return undefined;
  }, [onFileReceivedListener, onImportZip, dialog, t, toast]);

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
      toast.showSuccess(`已成功静默推送到 ${device.nickname}`);
    } else {
      toast.showError(`发送至 ${device.nickname} 失败，可能对端已掉线或文件过大超时。`);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <h3 className={styles.title}>{t('lan.title', '局域网设备互传 (LAN Sync)')}</h3>
          <div className={`${styles.statusDot} ${isActive ? styles.activeDot : ''}`}></div>
        </div>
        <p className={styles.subtitle}>
          {t('lan.desc', '在同一局域网络内的终端之间相互发现并高速传输备份数据。')}
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
             <p>{t('lan.radar_offline', '局域网侦听处于关闭状态。')}</p>
          </div>
        )}

        {isActive && devices.length === 0 && (
          <div className={styles.scanHint}>
            {t('lan.radar_online', '正在持续搜寻本网络环境中的其他活跃终端...')}
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
                onClick={(e) => {
                  e.stopPropagation();
                  handleSend(d);
                }}
              >
                {isSending ? `${progress}%` : t('lan.send_btn', '发起快传')}
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
           {isActive ? t('lan.stop_radar', '关闭局域网侦听') : t('lan.start_radar', '开启发现与侦听')}
         </button>
      </div>
    </div>
  );
};
