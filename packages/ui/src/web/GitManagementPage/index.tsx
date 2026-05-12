import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { PageSizeSelector, Pagination } from '@baishou/ui';
import './GitManagementPage.css';
import type {
  GitSyncConfig,
  GitCommit,
  VersionHistoryEntry,
  FileChange,
  FileDiff,
} from '@baishou/shared';

export interface GitManagementPageProps {
  // 配置
  config: GitSyncConfig;
  onSaveConfig: (config: Partial<GitSyncConfig>) => void;
  // 初始化
  onInit: () => Promise<{ success: boolean; message?: string }>;
  isInitialized: boolean;
  // 远程
  onTestRemote: () => Promise<boolean>;
  // 提交
  onAutoCommit: () => Promise<{ success: boolean; data: GitCommit | null }>;
  onCommit: (message: string) => Promise<GitCommit | null>;
  // 提示
  onToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  // 历史
  onGetHistory: (filePath?: string, limit?: number, offset?: number) => Promise<VersionHistoryEntry[]>;
  onGetCommitChanges: (commitHash: string) => Promise<FileChange[]>;
  onGetFileDiff: (filePath: string, commitHash?: string) => Promise<FileDiff>;
  // 同步
  onPush: () => Promise<{ success: boolean; message?: string }>;
  onPull: () => Promise<{ success: boolean; message?: string; conflicts?: string[] }>;
  onHasConflicts: () => Promise<boolean>;
  onGetConflicts: () => Promise<string[]>;
  onResolveConflict: (filePath: string, resolution: 'ours' | 'theirs') => Promise<{ success: boolean }>;
  // 回滚
  onRollbackFile: (filePath: string, commitHash: string) => Promise<{ success: boolean }>;
  onRollbackAll: (commitHash: string) => Promise<{ success: boolean }>;
}

export const GitManagementPage: React.FC<GitManagementPageProps> = ({
  config,
  onSaveConfig,
  onInit,
  isInitialized,
  onTestRemote,
  onAutoCommit,
  onCommit,
  onToast,
  onGetHistory,
  onGetCommitChanges,
  onGetFileDiff,
  onPush,
  onPull,
  onHasConflicts,
  onGetConflicts,
  onResolveConflict,
  onRollbackFile,
  onRollbackAll,
}) => {
  const { t } = useTranslation();

  const [tab, setTab] = useState<'config' | 'history'>('config');
  const [remoteUrl, setRemoteUrl] = useState(config.remote?.url || '');
  const [remoteBranch, setRemoteBranch] = useState(config.remote?.branch || 'main');
  const [autoCommit, setAutoCommit] = useState(config.autoCommit);

  const [history, setHistory] = useState<VersionHistoryEntry[]>([]);
  const [selectedCommit, setSelectedCommit] = useState<string | null>(null);
  const [commitChanges, setCommitChanges] = useState<FileChange[]>([]);
  const [selectedFileDiff, setSelectedFileDiff] = useState<FileDiff | null>(null);
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [expandedCommit, setExpandedCommit] = useState<string | null>(null);
  const [expandedFile, setExpandedFile] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [commitMessage, setCommitMessage] = useState('');

  useEffect(() => {
    setRemoteUrl(config.remote?.url || '');
    setRemoteBranch(config.remote?.branch || 'main');
    setAutoCommit(config.autoCommit);
  }, [config]);

  const handleInit = useCallback(async () => {
    const result = await onInit();
    if (result.success) {
      onToast(t('version_control.git_init_success', 'Git 仓库初始化成功'), 'success');
    } else {
      onToast(result.message || t('version_control.git_init_failed', '初始化失败'), 'error');
    }
  }, [onInit, onToast, t]);

  const handleSaveConfig = useCallback(async () => {
    try {
      onSaveConfig({
        autoCommit,
        remote: remoteUrl ? { url: remoteUrl, branch: remoteBranch } : undefined,
      });
      onToast(t('common.save_success', '保存成功'), 'success');
    } catch (e: any) {
      onToast(e?.message || t('common.error', '保存失败'), 'error');
    }
  }, [autoCommit, remoteUrl, remoteBranch, onSaveConfig, onToast, t]);

  const handleTestRemote = useCallback(async () => {
    const ok = await onTestRemote();
    onToast(
      ok ? t('version_control.connection_success', '连接成功') : t('version_control.connection_failed', '连接失败'),
      ok ? 'success' : 'error'
    );
  }, [onTestRemote, onToast, t]);

  const handlePush = useCallback(async () => {
    const result = await onPush();
    onToast(
      result.success ? t('version_control.push_success', '推送成功') : (result.message || t('version_control.git_push_failed', '推送失败')),
      result.success ? 'success' : 'error'
    );
  }, [onPush, onToast, t]);

  const handleManualCommit = useCallback(async () => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    const msg = commitMessage.trim() || timestamp;
    try {
      const result = await onCommit(msg);
      if (!result) {
        onToast(t('version_control.no_changes', '没有待提交的变更'), 'info');
        return;
      }
      onToast(
        t('version_control.commit_success_count', '提交成功: {{count}} 个文件已提交', { count: result.files.length }),
        'success'
      );
      setCommitMessage('');
      setCommitChanges([]);
      setSelectedFileDiff(null);
    } catch (e: any) {
      const errorMsg = e?.message || '';
      if (errorMsg.includes('No changes')) {
        onToast(t('version_control.no_changes', '没有待提交的变更'), 'info');
      } else {
        onToast(errorMsg || t('version_control.git_commit_failed', '提交失败'), 'error');
      }
    }
  }, [commitMessage, onCommit, onToast, t]);

  const handleCommitAndPush = useCallback(async () => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    const msg = commitMessage.trim() || timestamp;
    try {
      const result = await onCommit(msg);
      if (!result) {
        onToast(t('version_control.no_changes', '没有待提交的变更'), 'info');
        return;
      }
      onToast(
        t('version_control.commit_success_count', '提交成功: {{count}} 个文件已提交，正在推送...', { count: result.files.length }),
        'success'
      );
      setCommitMessage('');
      setSelectedCommit(null);
      setCommitChanges([]);
      setSelectedFileDiff(null);
      // 提交成功后推送
      const pushResult = await onPush();
      onToast(
        pushResult.success ? t('version_control.push_success', '推送成功') : (pushResult.message || t('version_control.git_push_failed', '推送失败')),
        pushResult.success ? 'success' : 'error'
      );
    } catch (e: any) {
      onToast(e?.message || t('version_control.git_commit_failed', '提交失败'), 'error');
    }
  }, [commitMessage, onCommit, onPush, onToast, t]);

  const handlePull = useCallback(async () => {
    const result = await onPull();
    if (result.success) {
      onToast(t('version_control.pull_success', '拉取成功'), 'success');
    } else {
      onToast(result.message || t('version_control.git_pull_failed', '拉取失败'), 'error');
      if (result.conflicts) {
        setConflicts(result.conflicts);
      }
    }
  }, [onPull, onToast, t]);

  const handleLoadHistory = useCallback(async () => {
    try {
      const offset = (page - 1) * pageSize;
      const entries = await onGetHistory(undefined, pageSize, offset);
      setTotalCount(entries.length === pageSize ? page * pageSize + 1 : (page - 1) * pageSize + entries.length);
      setHistory(entries);
    } catch {
      onToast(t('version_control.load_history_failed', '加载历史失败'), 'error');
    }
  }, [onGetHistory, page, pageSize, onToast, t]);

  // 翻页时重新加载
  useEffect(() => {
    if (tab === 'history') {
      handleLoadHistory();
    }
  }, [page, pageSize]);

  const handleSelectCommit = useCallback(async (hash: string) => {
    if (expandedCommit === hash) {
      setExpandedCommit(null);
      setCommitChanges([]);
      setSelectedFileDiff(null);
      return;
    }
    setExpandedCommit(hash);
    setSelectedCommit(hash);
    const changes = await onGetCommitChanges(hash);
    setCommitChanges(changes);
    setSelectedFileDiff(null);
  }, [expandedCommit, onGetCommitChanges]);

  const handleViewDiff = useCallback(async (filePath: string) => {
    if (expandedFile === filePath) {
      setExpandedFile(null);
      setSelectedFileDiff(null);
      return;
    }
    setExpandedFile(filePath);
    const diff = await onGetFileDiff(filePath, selectedCommit || undefined);
    setSelectedFileDiff(diff);
  }, [onGetFileDiff, selectedCommit, expandedFile]);

  const handleRollback = useCallback(async (filePath: string) => {
    if (!selectedCommit) return;
    const result = await onRollbackFile(filePath, selectedCommit);
    onToast(
      result.success ? t('version_control.rollback_success', '回滚成功') : t('version_control.git_rollback_failed', '回滚失败'),
      result.success ? 'success' : 'error'
    );
  }, [selectedCommit, onRollbackFile, onToast, t]);

  const handleRollbackAll = useCallback(async (commitHash: string) => {
    const result = await onRollbackAll(commitHash);
    onToast(
      result.success ? t('version_control.rollback_success', '回滚成功') : t('version_control.git_rollback_failed', '回滚失败'),
      result.success ? 'success' : 'error'
    );
  }, [onRollbackAll, onToast, t]);

  return (
    <div className="git-management-page">
      {/* 标签栏 */}
      <div className="gmp-tabs">
        <button
          className={`gmp-tab ${tab === 'config' ? 'gmp-tab-active' : ''}`}
          onClick={() => setTab('config')}
        >
          {t('version_control.git_settings', 'Git 设置')}
        </button>
        <button
          className={`gmp-tab ${tab === 'history' ? 'gmp-tab-active' : ''}`}
          onClick={() => { setTab('history'); handleLoadHistory(); }}
        >
          {t('version_control.version_history', '版本历史')}
        </button>
      </div>

      <AnimatePresence mode="wait">
        {tab === 'config' ? (
          <motion.div
            key="config"
            className="gmp-content"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            {/* 启用 Git */}
            <div className="gmp-section">
              <div className="gmp-section-header">
                <span className="gmp-label">{t('version_control.enable_git', '启用 Git 版本管理')}</span>
                <button
                  className={`gmp-switch ${config.enabled ? 'gmp-switch-on' : ''}`}
                  onClick={() => onSaveConfig({ enabled: !config.enabled })}
                >
                  <span className="gmp-switch-thumb" />
                </button>
              </div>
              {!isInitialized && (
                <button className="gmp-btn gmp-btn-primary" onClick={handleInit}>
                  {t('version_control.init_git', '初始化 Git 仓库')}
                </button>
              )}
            </div>

            {/* 手动提交 */}
            {isInitialized && (
              <div className="gmp-section">
                <div className="gmp-label">{t('version_control.manual_commit', '提交变更')}</div>
                <div className="gmp-commit-row">
                  <input
                    className="gmp-input"
                    type="text"
                    value={commitMessage}
                    onChange={(e) => setCommitMessage(e.target.value)}
                    placeholder={t('version_control.commit_placeholder', '未填写将使用时间戳')}
                  />
                  <button className="gmp-btn gmp-btn-primary" onClick={handleManualCommit}>
                    {t('version_control.commit_local', '本地提交')}
                  </button>
                  <button className="gmp-btn gmp-btn-primary" onClick={handleCommitAndPush}>
                    {t('version_control.commit_push', '提交并推送')}
                  </button>
                </div>
              </div>
            )}

            {/* 远程仓库配置 */}
            <div className="gmp-section">
              <div className="gmp-label">{t('version_control.remote_url', '远程仓库地址')}</div>
              <input
                className="gmp-input"
                type="text"
                value={remoteUrl}
                onChange={(e) => setRemoteUrl(e.target.value)}
                placeholder={t('version_control.remote_url_hint', '例如: https://github.com/username/vault.git')}
              />
              <div className="gmp-label" style={{ marginTop: 12 }}>
                {t('version_control.remote_branch', '远程分支')}
              </div>
              <input
                className="gmp-input"
                type="text"
                value={remoteBranch}
                onChange={(e) => setRemoteBranch(e.target.value)}
                placeholder={t('version_control.remote_branch_default', '默认: main')}
              />
              <div className="gmp-btn-row" style={{ marginTop: 12 }}>
                <button className="gmp-btn" onClick={handleTestRemote}>
                  {t('version_control.test_connection', '测试连接')}
                </button>
                <button className="gmp-btn gmp-btn-primary" onClick={handlePush}>
                  {t('version_control.push', '推送到远程')}
                </button>
                <button className="gmp-btn gmp-btn-primary" onClick={handlePull}>
                  {t('version_control.pull', '从远程拉取')}
                </button>
              </div>
            </div>

            {/* 自动提交 */}
            <div className="gmp-section">
              <div className="gmp-section-header">
                <span className="gmp-label">{t('version_control.auto_commit', '同步前自动提交')}</span>
                <button
                  className={`gmp-switch ${autoCommit ? 'gmp-switch-on' : ''}`}
                  onClick={() => {
                    const next = !autoCommit;
                    setAutoCommit(next);
                    onSaveConfig({ autoCommit: next });
                  }}
                >
                  <span className="gmp-switch-thumb" />
                </button>
              </div>
            </div>

            {/* 冲突处理 */}
            {conflicts.length > 0 && (
              <div className="gmp-section gmp-conflict">
                <div className="gmp-label">{t('version_control.conflict_detected', '检测到冲突')}</div>
                {conflicts.map((f) => (
                  <div key={f} className="gmp-conflict-row">
                    <span className="gmp-conflict-file">{f}</span>
                    <button className="gmp-btn-small" onClick={() => onResolveConflict(f, 'ours')}>
                      {t('version_control.resolve_ours', '保留本地')}
                    </button>
                    <button className="gmp-btn-small" onClick={() => onResolveConflict(f, 'theirs')}>
                      {t('version_control.resolve_theirs', '保留远程')}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="history"
            className="gmp-content"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            {history.length === 0 ? (
              <div className="gmp-empty">{t('version_control.no_history', '暂无版本历史')}</div>
            ) : (
              <div className="gmp-timeline">
                {history.map((entry) => (
                  <div key={entry.commit.hash} className="gmp-tl-commit">
                    {/* 时间线节点和连接线 */}
                    <div className="gmp-tl-gutter">
                      <div className={`gmp-tl-dot ${entry.isCurrent ? 'gmp-tl-dot-current' : ''}`} />
                      <div className="gmp-tl-line" />
                    </div>

                    {/* 提交内容 */}
                    <div className="gmp-tl-body">
                      <div
                        className={`gmp-tl-header ${expandedCommit === entry.commit.hash ? 'gmp-tl-header-expanded' : ''}`}
                        onClick={() => handleSelectCommit(entry.commit.hash)}
                      >
                        <span className="gmp-tl-message">{entry.commit.message}</span>
                        <span className="gmp-tl-meta">
                          <span className="gmp-tl-date">
                            {new Date(entry.commit.date).toLocaleString()}
                          </span>
                          <span className="gmp-tl-hash">{entry.commit.hash}</span>
                          <button
                            className="gmp-btn-small"
                            onClick={(e) => { e.stopPropagation(); handleRollbackAll(entry.commit.hash); }}
                            disabled={entry.isCurrent}
                          >
                            {t('version_control.rollback', '回滚')}
                          </button>
                          {entry.isCurrent && (
                            <span className="gmp-current-badge">{t('version_control.current_version', '当前版本')}</span>
                          )}
                        </span>
                      </div>

                      {/* 展开的文件变更列表 */}
                      {expandedCommit === entry.commit.hash && (
                        <div className="gmp-tl-changes">
                          {commitChanges.map((change) => (
                            <div key={change.path} className="gmp-tl-file">
                              <div
                                className="gmp-tl-file-header"
                                onClick={() => handleViewDiff(change.path)}
                              >
                                <span className={`gmp-tl-file-icon gmp-tl-file-${change.status}`}>
                                  {change.status === 'added' ? 'A' : change.status === 'deleted' ? 'D' : 'M'}
                                </span>
                                <span className="gmp-tl-file-path">{change.path}</span>
                                <span className="gmp-tl-file-stats">+{change.additions} -{change.deletions}</span>
                                <button
                                  className="gmp-btn-small"
                                  onClick={(e) => { e.stopPropagation(); handleRollback(change.path); }}
                                >
                                  {t('version_control.rollback', '回滚')}
                                </button>
                              </div>

                              {/* 内联 diff */}
                              {expandedFile === change.path && selectedFileDiff && (
                                <div className="gmp-diff-viewer">
                                  <pre className="gmp-diff-content">
                                    {selectedFileDiff.hunks.length === 0 ? (
                                      <div className="gmp-diff-normal" style={{ opacity: 0.5 }}>无差异</div>
                                    ) : (
                                      selectedFileDiff.hunks.map((hunk, i) => (
                                        <div key={i} className="gmp-diff-hunk">
                                          <div className="gmp-diff-hunk-header">
                                            @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
                                          </div>
                                          {hunk.content.split('\n').map((line, j) => (
                                            <div key={j} className={
                                              line.startsWith('+') ? 'gmp-diff-add' :
                                              line.startsWith('-') ? 'gmp-diff-remove' :
                                              'gmp-diff-normal'
                                            }>{line}</div>
                                          ))}
                                        </div>
                                      ))
                                    )}
                                  </pre>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 分页器 */}
            {history.length > 0 && (
              <div className="gmp-pagination-row">
                <PageSizeSelector
                  value={pageSize}
                  options={[10, 20, 50, 100]}
                  onChange={(size) => { setPageSize(size); setPage(1); }}
                />
                <Pagination
                  current={page}
                  total={Math.max(1, Math.ceil(totalCount / pageSize))}
                  onChange={setPage}
                  showFirstLast
                  showJumper
                  jumperPlaceholder={t('version_control.jump_page', '跳页')}
                />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
