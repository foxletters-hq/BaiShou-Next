import React, { useState, useCallback, useEffect } from 'react';
import { RefreshCw, CheckCircle, AlertTriangle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { SyncProgressEvent } from '@baishou/shared';
import { useToast } from '../Toast/useToast';
import styles from './IncrementalSyncPanel.module.css';

export interface SyncProgress {
  uploaded: number;
  downloaded: number;
  deletedRemote: number;
  deletedLocal: number;
  conflicts: number;
  skipped: number;
  duration: number;
  sessionId: string;
}

export interface SyncHistoryEntry {
  sessionId: string;
  deviceId: string;
  direction: string;
  startedAt: string;
  completedAt: string;
  success: boolean;
  summary: SyncProgress;
  error?: string;
}

export interface IncrementalSyncPanelProps {
  onSync: () => Promise<SyncProgress>;
  onGetHistory: (limit?: number) => Promise<SyncHistoryEntry[]>;
  isConfigured: boolean;
  onSyncProgress?: (callback: (event: SyncProgressEvent) => void) => (() => void);
}

export const IncrementalSyncPanel: React.FC<IncrementalSyncPanelProps> = ({
  onSync,
  onGetHistory,
  isConfigured,
  onSyncProgress,
}) => {
  const { t } = useTranslation();
  const toast = useToast();
  const [isSyncing, setIsSyncing] = useState(false);
  const [history, setHistory] = useState<SyncHistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [progress, setProgress] = useState<SyncProgressEvent | null>(null);

  useEffect(() => {
    if (isConfigured) {
      onGetHistory(5).then(setHistory).catch(() => {});
    }
  }, [isConfigured, onGetHistory]);

  useEffect(() => {
    if (!onSyncProgress) return undefined;
    const unsub = onSyncProgress((event) => {
      setProgress(event);
    });
    return unsub;
  }, [onSyncProgress]);

  const handleSync = useCallback(async () => {
    if (isSyncing || !isConfigured) return;
    setIsSyncing(true);
    setProgress(null);

    try {
      await onSync();
      setProgress(null);
      const updated = await onGetHistory(5).catch((): SyncHistoryEntry[] => []);
      setHistory(updated);
      toast.showSuccess(t('data_sync.sync_completed', '同步成功'));
    } catch (e) {
      toast.showError(t('data_sync.sync_failed', '同步失败'));
      setProgress(null);
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, isConfigured, onSync, onGetHistory, t, toast]);

  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMin = Math.floor(diffMs / 60000);
      if (diffMin < 1) return t('common.just_now', '刚刚');
      if (diffMin < 60) return t('common.minutes_ago', '$count 分钟前').replace('$count', diffMin.toString());
      const diffH = Math.floor(diffMin / 60);
      if (diffH < 24) return t('common.hours_ago', '$count 小时前').replace('$count', diffH.toString());
      const diffD = Math.floor(diffH / 24);
      if (diffD < 7) return t('common.days_ago', '$count 天前').replace('$count', diffD.toString());
      return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const lastLog = history.length > 0 ? history[0] : null;

  return (
    <>
      <div className={styles.container}>
        <button
          className={`${styles.syncButton} ${isSyncing ? styles.syncing : ''} ${!isConfigured ? styles.disabled : ''}`}
          onClick={handleSync}
          disabled={isSyncing || !isConfigured}
          title={isConfigured ? t('data_sync.sync_now', '同步') : t('common.not_configured', '未配置')}
        >
          <RefreshCw
            size={16}
            className={`${styles.syncIcon} ${isSyncing ? styles.spinning : ''}`}
          />
          <span className={styles.syncLabel}>
            {isSyncing ? t('data_sync.syncing', '同步中...') : t('data_sync.sync_now', '同步')}
          </span>
        </button>

        {lastLog && lastLog.success && (
          <button
            className={styles.lastSync}
            title={t('data_sync.last_sync', '上次同步')}
          >
            <CheckCircle size={12} className={styles.checkIcon} />
            <span>{formatTime(lastLog.completedAt)}</span>
          </button>
        )}

        {history.length > 0 && (
          <button
            className={styles.historyBtn}
            onClick={() => setShowHistory(!showHistory)}
            title={t('data_sync.sync_records', '同步历史')}
          >
            <span>{history.length}</span>
          </button>
        )}
      </div>

      <AnimatePresence>
        {isSyncing && progress && progress.total > 0 && (
          <motion.div
            className={styles.progressBarContainer}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className={styles.progressTrack}>
              <div
                className={styles.progressFill}
                style={{ width: `${Math.round((progress.current / progress.total) * 100)}%` }}
              />
            </div>
            <div className={styles.progressText}>
              {progress.current}/{progress.total}
              {progress.statusText && ` · ${progress.statusText}`}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showHistory && (
          <SyncHistoryPanel
            history={history}
            onClose={() => setShowHistory(false)}
            formatTime={formatTime}
            formatDuration={formatDuration}
          />
        )}
      </AnimatePresence>
    </>
  );
};

interface SyncHistoryPanelProps {
  history: SyncHistoryEntry[];
  onClose: () => void;
  formatTime: (iso: string) => string;
  formatDuration: (ms: number) => string;
}

const SyncHistoryPanel: React.FC<SyncHistoryPanelProps> = ({
  history,
  onClose,
  formatTime,
  formatDuration,
}) => {
  const { t } = useTranslation();

  return (
    <motion.div
      className={styles.overlay}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onClick={onClose}
    >
      <motion.div
        className={styles.historyPanel}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 20 }}
        transition={{ duration: 0.15 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.dialogHeader}>
          <h3>{t('data_sync.sync_records', '同步历史')}</h3>
          <button onClick={onClose} className={styles.closeBtn}>
            <X size={16} />
          </button>
        </div>

        {history.length === 0 ? (
          <div className={styles.emptyHistory}>{t('data_sync.no_records', '暂无同步记录')}</div>
        ) : (
          <div className={styles.historyList}>
            {history.map((entry) => (
              <div key={entry.sessionId} className={styles.historyItem}>
                <div className={styles.historyItemHeader}>
                  {entry.success ? (
                    <CheckCircle size={14} className={styles.successIcon} />
                  ) : (
                    <AlertTriangle size={14} className={styles.errorIcon} />
                  )}
                  <span className={styles.historyTime}>{formatTime(entry.completedAt)}</span>
                  <span className={styles.historyDuration}>{formatDuration(new Date(entry.completedAt).getTime() - new Date(entry.startedAt).getTime())}</span>
                </div>
                {entry.success ? (
                  <div className={styles.historySummary}>
                    <span>↑{entry.summary.uploaded}</span>
                    <span>↓{entry.summary.downloaded}</span>
                    <span>✕{entry.summary.deletedRemote + entry.summary.deletedLocal}</span>
                    {entry.summary.conflicts > 0 && (
                      <span className={styles.warnText}>!{entry.summary.conflicts}</span>
                    )}
                  </div>
                ) : (
                  <div className={styles.historyError}>{entry.error}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};
