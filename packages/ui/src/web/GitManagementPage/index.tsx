import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { PageSizeSelector, Pagination } from '@baishou/ui';
import './GitManagementPage.css';
import type {
  GitSyncConfig,
  GitCommit,
  GitStatus,
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
  onCommit: (message: string) => Promise<GitCommit | null>;
  // 提示
  onToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  // 状态
  onGetStatus: () => Promise<GitStatus>;
  // 历史
  onGetHistory: (filePath?: string, limit?: number, offset?: number) => Promise<VersionHistoryEntry[]>;
  onGetRecentPulls: (limit?: number) => Promise<VersionHistoryEntry[]>;
  onGetCommitChanges: (commitHash: string) => Promise<FileChange[]>;
  onGetFileDiff: (filePath: string, commitHash?: string) => Promise<FileDiff>;
  onGetWorkingDiff: (filePath: string, staged: boolean) => Promise<FileDiff>;
  // 暂存操作
  onUnstageFile: (filePath: string) => Promise<void>;
  onDiscardFile: (filePath: string) => Promise<void>;
  onDiscardAllChanges: () => Promise<void>;
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
  onCommit,
  onToast,
  onGetStatus,
  onGetHistory,
  onGetRecentPulls,
  onGetCommitChanges,
  onGetFileDiff,
  onGetWorkingDiff,
  onUnstageFile,
  onDiscardFile,
  onDiscardAllChanges,
  onPush,
  onPull,
  onHasConflicts,
  onGetConflicts,
  onResolveConflict,
  onRollbackFile,
  onRollbackAll,
}) => {
  const { t } = useTranslation();

  const [tab, setTab] = useState<'config' | 'version'>('config');
  const [remoteUrl, setRemoteUrl] = useState(config.remote?.url || '');
  const [remoteBranch, setRemoteBranch] = useState(config.remote?.branch || 'main');
  const [showPassword, setShowPassword] = useState(false);
  const [commitTemplate, setCommitTemplate] = useState(config.commitMessageTemplate);

  // 工作区状态
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);

  // 可折叠区域
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    staged: true,
    changes: true,
    commits: true,
    pulls: true,
  });

  // 历史记录
  const [history, setHistory] = useState<VersionHistoryEntry[]>([]);
  const [recentPulls, setRecentPulls] = useState<VersionHistoryEntry[]>([]);
  const [selectedCommit, setSelectedCommit] = useState<string | null>(null);
  const [commitChanges, setCommitChanges] = useState<FileChange[]>([]);
  const [selectedFileDiff, setSelectedFileDiff] = useState<FileDiff | null>(null);
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [expandedCommit, setExpandedCommit] = useState<string | null>(null);
  const [expandedFile, setExpandedFile] = useState<string | null>(null);
  const [expandedWorkingFile, setExpandedWorkingFile] = useState<string | null>(null);
  const [workingFileDiff, setWorkingFileDiff] = useState<FileDiff | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [commitMessage, setCommitMessage] = useState('');

  useEffect(() => {
    setRemoteUrl(config.remote?.url || '');
    setRemoteBranch(config.remote?.branch || 'main');
    setCommitTemplate(config.commitMessageTemplate);
  }, [config]);

  const toggleSection = useCallback((section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  }, []);

  const handleRefreshStatus = useCallback(async () => {
    try {
      const status = await onGetStatus();
      setGitStatus(status);
    } catch {
      // 静默失败
    }
  }, [onGetStatus]);

  const handleInit = useCallback(async () => {
    const result = await onInit();
    if (result.success) {
      onToast(t('version_control.git_init_success', 'Git 仓库初始化成功'), 'success');
      handleRefreshStatus();
    } else {
      onToast(result.message || t('version_control.git_init_failed', '初始化失败'), 'error');
    }
  }, [onInit, onToast, t, handleRefreshStatus]);

  const handleSaveConfig = useCallback(async () => {
    try {
      onSaveConfig({
        commitMessageTemplate: commitTemplate,
        remote: remoteUrl ? { url: remoteUrl, branch: remoteBranch } : undefined,
      });
      onToast(t('common.save_success', '保存成功'), 'success');
    } catch (e: any) {
      onToast(e?.message || t('common.error', '保存失败'), 'error');
    }
  }, [commitTemplate, remoteUrl, remoteBranch, onSaveConfig, onToast, t]);

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
      handleRefreshStatus();
      handleLoadHistory();
    } catch (e: any) {
      const errorMsg = e?.message || '';
      if (errorMsg.includes('No changes')) {
        onToast(t('version_control.no_changes', '没有待提交的变更'), 'info');
      } else {
        onToast(errorMsg || t('version_control.git_commit_failed', '提交失败'), 'error');
      }
    }
  }, [commitMessage, onCommit, onToast, t, handleRefreshStatus]);

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
      handleRefreshStatus();
      const pushResult = await onPush();
      onToast(
        pushResult.success ? t('version_control.push_success', '推送成功') : (pushResult.message || t('version_control.git_push_failed', '推送失败')),
        pushResult.success ? 'success' : 'error'
      );
    } catch (e: any) {
      onToast(e?.message || t('version_control.git_commit_failed', '提交失败'), 'error');
    }
  }, [commitMessage, onCommit, onPush, onToast, t, handleRefreshStatus]);

  const handlePull = useCallback(async () => {
    const result = await onPull();
    if (result.success) {
      onToast(t('version_control.pull_success', '拉取成功'), 'success');
      handleRefreshStatus();
      handleLoadHistory();
    } else {
      onToast(result.message || t('version_control.git_pull_failed', '拉取失败'), 'error');
      if (result.conflicts) {
        setConflicts(result.conflicts);
      }
    }
  }, [onPull, onToast, t, handleRefreshStatus]);

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

  const handleLoadRecentPulls = useCallback(async () => {
    try {
      const pulls = await onGetRecentPulls(10);
      setRecentPulls(pulls);
    } catch {
      // 静默失败
    }
  }, [onGetRecentPulls]);

  useEffect(() => {
    if (tab === 'version') {
      handleLoadHistory();
      handleRefreshStatus();
      handleLoadRecentPulls();
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

  const handleViewWorkingDiff = useCallback(async (filePath: string, staged: boolean) => {
    if (expandedWorkingFile === filePath) {
      setExpandedWorkingFile(null);
      setWorkingFileDiff(null);
      return;
    }
    setExpandedWorkingFile(filePath);
    const diff = await onGetWorkingDiff(filePath, staged);
    setWorkingFileDiff(diff);
  }, [onGetWorkingDiff, expandedWorkingFile]);

  const handleUnstageFile = useCallback(async (filePath: string) => {
    await onUnstageFile(filePath);
    handleRefreshStatus();
  }, [onUnstageFile, handleRefreshStatus]);

  const handleDiscardFile = useCallback(async (filePath: string) => {
    await onDiscardFile(filePath);
    handleRefreshStatus();
  }, [onDiscardFile, handleRefreshStatus]);

  const handleDiscardAll = useCallback(async () => {
    await onDiscardAllChanges();
    handleRefreshStatus();
  }, [onDiscardAllChanges, handleRefreshStatus]);

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

  const stagedCount = gitStatus?.staged.length ?? 0;
  const unstagedCount = (gitStatus?.unstaged.length ?? 0) + (gitStatus?.untracked.length ?? 0);

  const getFileStatusIcon = (status: string) => {
    switch (status) {
      case 'added': return 'A';
      case 'deleted': return 'D';
      case 'renamed': return 'R';
      default: return 'M';
    }
  };

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
          className={`gmp-tab ${tab === 'version' ? 'gmp-tab-active' : ''}`}
          onClick={() => { setTab('version'); handleLoadHistory(); handleRefreshStatus(); handleLoadRecentPulls(); }}
        >
          {t('version_control.version_control', '版本控制')}
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
            {/* 初始化 Git */}
            {!isInitialized && (
              <div className="gmp-section">
                <div className="gmp-section-header">
                  <span className="gmp-label">{t('version_control.git_status', 'Git 仓库状态')}</span>
                </div>
                <button className="gmp-btn gmp-btn-primary" onClick={handleInit}>
                  {t('version_control.init_git', '初始化 Git 仓库')}
                </button>
              </div>
            )}
            {isInitialized && (
              <div className="gmp-section">
                <div className="gmp-section-header">
                  <span className="gmp-label">{t('version_control.git_status', 'Git 仓库状态')}</span>
                  <span style={{ fontSize: 13, color: 'var(--color-primary)' }}>
                    {t('version_control.git_enabled', '已启用')}
                  </span>
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

            {/* 提交消息模板 */}
            <div className="gmp-section">
              <div className="gmp-label">
                {t('version_control.commit_message_template', '提交消息模板')}
              </div>
              <input
                className="gmp-input"
                type="text"
                value={commitTemplate}
                onChange={(e) => setCommitTemplate(e.target.value)}
                placeholder={t('version_control.commit_message_hint', '支持 {date} 占位符')}
              />
              <button className="gmp-btn" style={{ marginTop: 12 }} onClick={handleSaveConfig}>
                {t('common.save', '保存配置')}
              </button>
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
            key="version"
            className="gmp-content"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            {/* 提交输入区域 */}
            {isInitialized && (
              <div className="gmp-commit-area">
                <input
                  className="gmp-input gmp-commit-input"
                  type="text"
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  placeholder={t('version_control.commit_placeholder', '输入提交消息，留空将使用时间戳')}
                />
                <button className="gmp-btn gmp-btn-primary" onClick={handleManualCommit}>
                  {t('version_control.commit_local', '提交')}
                </button>
                <button className="gmp-btn gmp-btn-primary" onClick={handleCommitAndPush}>
                  {t('version_control.commit_push', '提交并推送')}
                </button>
              </div>
            )}

            {/* Staged Changes */}
            {isInitialized && (
              <div className="gmp-collapsible-section">
                <div
                  className="gmp-collapsible-header"
                  onClick={() => toggleSection('staged')}
                >
                  <span className="gmp-collapsible-arrow">
                    {expandedSections.staged ? '▾' : '▸'}
                  </span>
                  <span className="gmp-collapsible-title">
                    {t('version_control.staged_changes', 'Staged Changes')}
                  </span>
                  {stagedCount > 0 && (
                    <span className="gmp-collapsible-badge">{stagedCount}</span>
                  )}
                </div>
                {expandedSections.staged && (
                  <div className="gmp-collapsible-body">
                    {stagedCount === 0 ? (
                      <div className="gmp-section-empty">
                        {t('version_control.no_staged_changes', '没有已暂存的变更')}
                      </div>
                    ) : (
                      gitStatus!.staged.map((file) => (
                        <div key={file.path}>
                          <div
                            className="gmp-file-row gmp-file-row-clickable"
                            onClick={() => handleViewWorkingDiff(file.path, true)}
                          >
                            <span className={`gmp-file-badge gmp-file-${file.stagedStatus}`}>
                              {getFileStatusIcon(file.stagedStatus)}
                            </span>
                            <span className="gmp-file-path">{file.path}</span>
                            <button
                              className="gmp-btn-tiny"
                              onClick={(e) => { e.stopPropagation(); handleUnstageFile(file.path); }}
                            >
                              {t('version_control.unstage', '取消暂存')}
                            </button>
                          </div>
                          {expandedWorkingFile === file.path && workingFileDiff && (
                            <div className="gmp-diff-viewer">
                              <pre className="gmp-diff-content">
                                {workingFileDiff.hunks.length === 0 ? (
                                  <div className="gmp-diff-normal" style={{ opacity: 0.5 }}>无差异</div>
                                ) : (
                                  workingFileDiff.hunks.map((hunk, i) => (
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
                      ))
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Changes (Unstaged) */}
            {isInitialized && (
              <div className="gmp-collapsible-section">
                <div
                  className="gmp-collapsible-header"
                  onClick={() => toggleSection('changes')}
                >
                  <span className="gmp-collapsible-arrow">
                    {expandedSections.changes ? '▾' : '▸'}
                  </span>
                  <span className="gmp-collapsible-title">
                    {t('version_control.changes', 'Changes')}
                  </span>
                  {unstagedCount > 0 && (
                    <span className="gmp-collapsible-badge">{unstagedCount}</span>
                  )}
                  {unstagedCount > 0 && (
                    <button
                      className="gmp-btn-tiny"
                      onClick={(e) => { e.stopPropagation(); handleDiscardAll(); }}
                    >
                      {t('version_control.discard_all', '全部撤销')}
                    </button>
                  )}
                </div>
                {expandedSections.changes && (
                  <div className="gmp-collapsible-body">
                    {unstagedCount === 0 ? (
                      <div className="gmp-section-empty">
                        {t('version_control.no_changes', '没有变更')}
                      </div>
                    ) : (
                      <>
                        {gitStatus!.unstaged.map((file) => (
                          <div key={file.path}>
                            <div
                              className="gmp-file-row gmp-file-row-clickable"
                              onClick={() => handleViewWorkingDiff(file.path, false)}
                            >
                              <span className={`gmp-file-badge gmp-file-${file.unstagedStatus}`}>
                                {getFileStatusIcon(file.unstagedStatus)}
                              </span>
                              <span className="gmp-file-path">{file.path}</span>
                              <button
                                className="gmp-btn-tiny"
                                onClick={(e) => { e.stopPropagation(); handleDiscardFile(file.path); }}
                              >
                                {t('version_control.discard', '撤销')}
                              </button>
                            </div>
                          </div>
                        ))}
                        {gitStatus!.untracked.map((file) => (
                          <div key={file} className="gmp-file-row">
                            <span className="gmp-file-badge gmp-file-untracked">U</span>
                            <span className="gmp-file-path">{file}</span>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Recent Commits */}
            <div className="gmp-collapsible-section">
              <div
                className="gmp-collapsible-header"
                onClick={() => toggleSection('commits')}
              >
                <span className="gmp-collapsible-arrow">
                  {expandedSections.commits ? '▾' : '▸'}
                </span>
                <span className="gmp-collapsible-title">
                  {t('version_control.recent_commits', 'Recent Commits')}
                </span>
                {history.length > 0 && (
                  <span className="gmp-collapsible-badge">{history.length}</span>
                )}
              </div>
              {expandedSections.commits && (
                <div className="gmp-collapsible-body">
                  {history.length === 0 ? (
                    <div className="gmp-section-empty">
                      {t('version_control.no_history', '暂无提交历史')}
                    </div>
                  ) : (
                    <>
                      <div className="gmp-timeline">
                        {history.map((entry) => (
                          <div key={entry.commit.hash} className="gmp-tl-commit">
                            <div className="gmp-tl-gutter">
                              <div className={`gmp-tl-dot ${entry.isCurrent ? 'gmp-tl-dot-current' : ''}`} />
                              <div className="gmp-tl-line" />
                            </div>

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
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Recent Pulls */}
            <div className="gmp-collapsible-section">
              <div
                className="gmp-collapsible-header"
                onClick={() => toggleSection('pulls')}
              >
                <span className="gmp-collapsible-arrow">
                  {expandedSections.pulls ? '▾' : '▸'}
                </span>
                <span className="gmp-collapsible-title">
                  {t('version_control.recent_pulls', 'Recent Pulls')}
                </span>
                {recentPulls.length > 0 && (
                  <span className="gmp-collapsible-badge">{recentPulls.length}</span>
                )}
              </div>
              {expandedSections.pulls && (
                <div className="gmp-collapsible-body">
                  {recentPulls.length === 0 ? (
                    <div className="gmp-section-empty">
                      {t('version_control.no_recent_pulls', '暂无拉取记录')}
                    </div>
                  ) : (
                    recentPulls.map((entry) => (
                      <div key={entry.commit.hash} className="gmp-file-row">
                        <span className="gmp-tl-hash" style={{ marginRight: 8 }}>
                          {entry.commit.hash}
                        </span>
                        <span className="gmp-file-path" style={{ flex: 1 }}>
                          {entry.commit.message}
                        </span>
                        <span className="gmp-tl-date">
                          {new Date(entry.commit.date).toLocaleString()}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* 冲突处理 */}
            {conflicts.length > 0 && (
              <div className="gmp-section gmp-conflict" style={{ marginTop: 16 }}>
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
        )}
      </AnimatePresence>
    </div>
  );
};
