import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import './VersionHistorySidebar.css';
import type { VersionHistoryEntry, FileDiff, FileChange } from '@baishou/shared';

export interface VersionHistorySidebarProps {
  filePath: string;
  onGetHistory: (filePath: string, limit?: number) => Promise<VersionHistoryEntry[]>;
  onGetFileDiff: (filePath: string, commitHash?: string) => Promise<FileDiff>;
  onGetCommitChanges: (commitHash: string) => Promise<FileChange[]>;
  onRollback: (filePath: string, commitHash: string) => Promise<{ success: boolean }>;
  isOpen: boolean;
  onClose: () => void;
}

export const VersionHistorySidebar: React.FC<VersionHistorySidebarProps> = ({
  filePath,
  onGetHistory,
  onGetFileDiff,
  onGetCommitChanges,
  onRollback,
  isOpen,
  onClose,
}) => {
  const { t } = useTranslation();
  const [history, setHistory] = useState<VersionHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCommit, setSelectedCommit] = useState<string | null>(null);
  const [selectedDiff, setSelectedDiff] = useState<FileDiff | null>(null);
  const [rollbackConfirm, setRollbackConfirm] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    if (!filePath) return;
    setLoading(true);
    try {
      const entries = await onGetHistory(filePath, 20);
      setHistory(entries);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [filePath, onGetHistory]);

  React.useEffect(() => {
    if (isOpen && filePath) {
      loadHistory();
    }
  }, [isOpen, filePath, loadHistory]);

  const handleSelectCommit = useCallback(async (hash: string) => {
    setSelectedCommit(hash);
    try {
      const diff = await onGetFileDiff(filePath, hash);
      setSelectedDiff(diff);
    } catch {
      setSelectedDiff(null);
    }
  }, [filePath, onGetFileDiff]);

  const handleRollback = useCallback(async (hash: string) => {
    await onRollback(filePath, hash);
    setRollbackConfirm(null);
    setSelectedCommit(null);
    setSelectedDiff(null);
    loadHistory();
  }, [filePath, onRollback, loadHistory]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="vhs-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="vhs-panel"
            initial={{ x: 320 }}
            animate={{ x: 0 }}
            exit={{ x: 320 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="vhs-header">
              <span className="vhs-title">{t('version_control.version_history', '版本历史')}</span>
              <button className="vhs-close" onClick={onClose}>×</button>
            </div>

            {loading ? (
              <div className="vhs-loading">{t('common.loading', '加载中...')}</div>
            ) : history.length === 0 ? (
              <div className="vhs-empty">{t('version_control.no_history', '暂无版本历史')}</div>
            ) : (
              <div className="vhs-list">
                {history.map((entry) => (
                  <div key={entry.commit.hash} className="vhs-item">
                    <div
                      className={`vhs-item-header ${selectedCommit === entry.commit.hash ? 'vhs-item-active' : ''}`}
                      onClick={() => handleSelectCommit(entry.commit.hash)}
                    >
                      <div className="vhs-item-message">{entry.commit.message}</div>
                      <div className="vhs-item-date">
                        {new Date(entry.commit.date).toLocaleString()}
                      </div>
                    </div>

                    {selectedCommit === entry.commit.hash && selectedDiff && (
                      <div className="vhs-diff-preview">
                        <pre className="vhs-diff-content">
                          {selectedDiff.hunks.map((hunk, i) => (
                            <div key={i}>
                              <div className="vhs-diff-hunk-header">
                                @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
                              </div>
                              {hunk.content.split('\n').map((line, j) => (
                                <div key={j} className={
                                  line.startsWith('+') ? 'vhs-diff-add' :
                                  line.startsWith('-') ? 'vhs-diff-remove' :
                                  'vhs-diff-normal'
                                }>{line}</div>
                              ))}
                            </div>
                          ))}
                        </pre>

                        <div className="vhs-actions">
                          {rollbackConfirm === entry.commit.hash ? (
                            <div className="vhs-confirm-row">
                              <span className="vhs-confirm-text">
                                {t('version_control.rollback_confirm', '确定回滚吗？')}
                              </span>
                              <button className="vhs-btn vhs-btn-danger" onClick={() => handleRollback(entry.commit.hash)}>
                                {t('common.confirm', '确定')}
                              </button>
                              <button className="vhs-btn" onClick={() => setRollbackConfirm(null)}>
                                {t('common.cancel', '取消')}
                              </button>
                            </div>
                          ) : (
                            <button
                              className="vhs-btn"
                              onClick={() => setRollbackConfirm(entry.commit.hash)}
                              disabled={entry.isCurrent}
                            >
                              {entry.isCurrent
                                ? t('version_control.current_version', '当前版本')
                                : t('version_control.rollback', '回滚到此版本')}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
