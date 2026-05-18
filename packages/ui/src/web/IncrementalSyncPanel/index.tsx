import React, { useState, useCallback, useEffect } from 'react';
import { RefreshCw, CheckCircle, AlertTriangle, Upload, Download, Trash2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
}

export const IncrementalSyncPanel: React.FC<IncrementalSyncPanelProps> = ({
  onSync,
  onGetHistory,
  isConfigured,
}) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<SyncProgress | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<SyncHistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (isConfigured) {
      onGetHistory(5).then(setHistory).catch(() => {});
    }
  }, [isConfigured, onGetHistory]);

  const handleSync = useCallback(async () => {
    if (isSyncing || !isConfigured) return;
    setIsSyncing(true);
    setError(null);

    try {
      const result = await onSync();
      setLastResult(result);
      setShowResult(true);
      const updated = await onGetHistory(5).catch(() => []);
      setHistory(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : '同步失败');
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, isConfigured, onSync, onGetHistory]);

  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMin = Math.floor(diffMs / 60000);
      if (diffMin < 1) return '刚刚';
      if (diffMin < 60) return `${diffMin} 分钟前`;
      const diffH = Math.floor(diffMin / 60);
      if (diffH < 24) return `${diffH} 小时前`;
      const diffD = Math.floor(diffH / 24);
      if (diffD < 7) return `${diffD} 天前`;
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
          title={isConfigured ? '同步到 S3' : '请先配置 S3 同步'}
        >
          <RefreshCw
            size={16}
            className={`${styles.syncIcon} ${isSyncing ? styles.spinning : ''}`}
          />
          <span className={styles.syncLabel}>
            {isSyncing ? '同步中...' : '同步'}
          </span>
        </button>

        {lastLog && lastLog.success && (
          <button
            className={styles.lastSync}
            onClick={() => setShowResult(true)}
            title="查看上次同步详情"
          >
            <CheckCircle size={12} className={styles.checkIcon} />
            <span>上次同步: {formatTime(lastLog.completedAt)}</span>
          </button>
        )}

        {history.length > 0 && (
          <button
            className={styles.historyBtn}
            onClick={() => setShowHistory(!showHistory)}
            title="同步历史"
          >
            <span>{history.length}</span>
          </button>
        )}
      </div>

      <AnimatePresence>
        {showResult && lastResult && (
          <SyncResultDialog
            result={lastResult}
            onClose={() => setShowResult(false)}
          />
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

      <AnimatePresence>
        {error && (
          <motion.div
            className={styles.errorToast}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
          >
            <AlertTriangle size={14} />
            <span>{error}</span>
            <button onClick={() => setError(null)} className={styles.errorClose}>
              <X size={12} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

interface SyncResultDialogProps {
  result: SyncProgress;
  onClose: () => void;
}

const SyncResultDialog: React.FC<SyncResultDialogProps> = ({ result, onClose }) => {
  const { uploaded, downloaded, deletedRemote, deletedLocal, conflicts, skipped, duration } = result;
  const total = uploaded + downloaded + deletedRemote + deletedLocal + conflicts + skipped;

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
        className={styles.dialog}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.15 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.dialogHeader}>
          <h3>同步完成</h3>
          <button onClick={onClose} className={styles.closeBtn}>
            <X size={16} />
          </button>
        </div>

        <div className={styles.resultGrid}>
          <div className={styles.resultItem}>
            <Upload size={14} />
            <span className={styles.resultLabel}>上传</span>
            <span className={styles.resultValue}>{uploaded}</span>
          </div>
          <div className={styles.resultItem}>
            <Download size={14} />
            <span className={styles.resultLabel}>下载</span>
            <span className={styles.resultValue}>{downloaded}</span>
          </div>
          <div className={styles.resultItem}>
            <Trash2 size={14} />
            <span className={styles.resultLabel}>删除</span>
            <span className={styles.resultValue}>{deletedRemote + deletedLocal}</span>
          </div>
          {conflicts > 0 && (
            <div className={`${styles.resultItem} ${styles.warningItem}`}>
              <AlertTriangle size={14} />
              <span className={styles.resultLabel}>冲突</span>
              <span className={styles.resultValue}>{conflicts}</span>
            </div>
          )}
          <div className={styles.resultItem}>
            <CheckCircle size={14} />
            <span className={styles.resultLabel}>跳过</span>
            <span className={styles.resultValue}>{skipped}</span>
          </div>
        </div>

        <div className={styles.resultFooter}>
          <span>共处理 {total} 个文件</span>
          <span>耗时 {(duration / 1000).toFixed(1)}s</span>
        </div>
      </motion.div>
    </motion.div>
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
          <h3>同步历史</h3>
          <button onClick={onClose} className={styles.closeBtn}>
            <X size={16} />
          </button>
        </div>

        {history.length === 0 ? (
          <div className={styles.emptyHistory}>暂无同步记录</div>
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
