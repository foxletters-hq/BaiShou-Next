import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
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
  onCommit: (message: string) => Promise<GitCommit>;
  // 历史
  onGetHistory: (filePath?: string, limit?: number) => Promise<VersionHistoryEntry[]>;
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
}

export const GitManagementPage: React.FC<GitManagementPageProps> = ({
  config,
  onSaveConfig,
  onInit,
  isInitialized,
  onTestRemote,
  onAutoCommit,
  onCommit,
  onGetHistory,
  onGetCommitChanges,
  onGetFileDiff,
  onPush,
  onPull,
  onHasConflicts,
  onGetConflicts,
  onResolveConflict,
  onRollbackFile,
}) => {
  const { t } = useTranslation();

  const [tab, setTab] = useState<'config' | 'history'>('config');
  const [remoteUrl, setRemoteUrl] = useState(config.remote?.url || '');
  const [remoteBranch, setRemoteBranch] = useState(config.remote?.branch || 'main');
  const [autoCommit, setAutoCommit] = useState(config.autoCommit);
  const [commitTemplate, setCommitTemplate] = useState(config.commitMessageTemplate);
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [statusText, setStatusText] = useState('');

  const [history, setHistory] = useState<VersionHistoryEntry[]>([]);
  const [selectedCommit, setSelectedCommit] = useState<string | null>(null);
  const [commitChanges, setCommitChanges] = useState<FileChange[]>([]);
  const [selectedFileDiff, setSelectedFileDiff] = useState<FileDiff | null>(null);
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [commitMessage, setCommitMessage] = useState('更新日记数据');

  useEffect(() => {
    setRemoteUrl(config.remote?.url || '');
    setRemoteBranch(config.remote?.branch || 'main');
    setAutoCommit(config.autoCommit);
    setCommitTemplate(config.commitMessageTemplate);
  }, [config]);

  const handleInit = useCallback(async () => {
    setStatus('loading');
    const result = await onInit();
    setStatus(result.success ? 'success' : 'error');
    setStatusText(result.success ? t('version_control.git_init_success', 'Git 仓库初始化成功') : (result.message || t('version_control.git_init_failed', '初始化失败')));
  }, [onInit, t]);

  const handleSaveConfig = useCallback(async () => {
    setStatus('loading');
    try {
      onSaveConfig({
        autoCommit,
        commitMessageTemplate: commitTemplate,
        remote: remoteUrl ? { url: remoteUrl, branch: remoteBranch } : undefined,
      });
      setStatus('success');
      setStatusText(t('common.save_success', '保存成功'));
    } catch (e: any) {
      setStatus('error');
      setStatusText(e?.message || t('common.error', '保存失败'));
    }
  }, [autoCommit, commitTemplate, remoteUrl, remoteBranch, onSaveConfig, t]);

  const handleTestRemote = useCallback(async () => {
    setStatus('loading');
    const ok = await onTestRemote();
    setStatus(ok ? 'success' : 'error');
    setStatusText(ok ? t('version_control.connection_success', '连接成功') : t('version_control.connection_failed', '连接失败'));
  }, [onTestRemote, t]);

  const handlePush = useCallback(async () => {
    setStatus('loading');
    const result = await onPush();
    setStatus(result.success ? 'success' : 'error');
    setStatusText(result.success ? t('version_control.push_success', '推送成功') : (result.message || t('version_control.git_push_failed', '推送失败')));
  }, [onPush, t]);

  const handleManualCommit = useCallback(async () => {
    if (!commitMessage.trim()) return;
    setStatus('loading');
    try {
      await onCommit(commitMessage.trim());
      setStatus('success');
      setStatusText(t('version_control.commit_success', '提交成功'));
      setCommitMessage('');
    } catch (e: any) {
      setStatus('error');
      setStatusText(e?.message || t('version_control.git_commit_failed', '提交失败'));
    }
  }, [commitMessage, onCommit, t]);

  const handlePull = useCallback(async () => {
    setStatus('loading');
    const result = await onPull();
    if (result.success) {
      setStatus('success');
      setStatusText(t('version_control.pull_success', '拉取成功'));
    } else {
      setStatus('error');
      setStatusText(result.message || t('version_control.git_pull_failed', '拉取失败'));
      if (result.conflicts) {
        setConflicts(result.conflicts);
      }
    }
  }, [onPull, t]);

  const handleLoadHistory = useCallback(async () => {
    setStatus('loading');
    try {
      const entries = await onGetHistory(undefined, 50);
      setHistory(entries);
      setStatus('idle');
    } catch {
      setStatus('error');
      setStatusText(t('version_control.load_history_failed', '加载历史失败'));
    }
  }, [onGetHistory, t]);

  const handleSelectCommit = useCallback(async (hash: string) => {
    setSelectedCommit(hash);
    const changes = await onGetCommitChanges(hash);
    setCommitChanges(changes);
    setSelectedFileDiff(null);
  }, [onGetCommitChanges]);

  const handleViewDiff = useCallback(async (filePath: string) => {
    const diff = await onGetFileDiff(filePath, selectedCommit || undefined);
    setSelectedFileDiff(diff);
  }, [onGetFileDiff, selectedCommit]);

  const handleRollback = useCallback(async (filePath: string) => {
    if (!selectedCommit) return;
    setStatus('loading');
    const result = await onRollbackFile(filePath, selectedCommit);
    setStatus(result.success ? 'success' : 'error');
    setStatusText(result.success ? t('version_control.rollback_success', '回滚成功') : t('version_control.git_rollback_failed', '回滚失败'));
  }, [selectedCommit, onRollbackFile, t]);

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
                <div className="gmp-label">{t('version_control.manual_commit', '手动提交')}</div>
                <div className="gmp-commit-row">
                  <input
                    className="gmp-input"
                    type="text"
                    value={commitMessage}
                    onChange={(e) => setCommitMessage(e.target.value)}
                    placeholder={t('version_control.commit_message_placeholder', '输入提交消息...')}
                  />
                  <button className="gmp-btn gmp-btn-primary" onClick={handleManualCommit}>
                    {t('version_control.commit_btn', '提交')}
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
                  onClick={() => setAutoCommit(!autoCommit)}
                >
                  <span className="gmp-switch-thumb" />
                </button>
              </div>
              <div className="gmp-label" style={{ marginTop: 12 }}>
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
            key="history"
            className="gmp-content"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            {history.length === 0 ? (
              <div className="gmp-empty">{t('version_control.no_history', '暂无版本历史')}</div>
            ) : (
              <div className="gmp-history-layout">
                <div className="gmp-history-list">
                  {history.map((entry) => (
                    <div
                      key={entry.commit.hash}
                      className={`gmp-history-item ${selectedCommit === entry.commit.hash ? 'gmp-history-item-active' : ''}`}
                      onClick={() => handleSelectCommit(entry.commit.hash)}
                    >
                      <div className="gmp-history-message">{entry.commit.message}</div>
                      <div className="gmp-history-meta">
                        <span className="gmp-history-meta-text">
                          {new Date(entry.commit.date).toLocaleString()}
                        </span>
                        <span className="gmp-history-meta-text">
                          {entry.commit.files.length} {t('version_control.changes', '变更')}
                        </span>
                        {entry.isCurrent && (
                          <span className="gmp-current-badge">{t('version_control.current_version', '当前版本')}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="gmp-history-detail">
                  {selectedCommit && commitChanges.length > 0 && (
                    <>
                      <div className="gmp-label" style={{ marginBottom: 12 }}>
                        {t('version_control.changes', '变更文件')}
                      </div>
                      {commitChanges.map((change) => (
                        <div
                          key={change.path}
                          className={`gmp-change-item ${selectedFileDiff?.path === change.path ? 'gmp-change-item-active' : ''}`}
                          onClick={() => handleViewDiff(change.path)}
                        >
                          <span className={`gmp-change-status gmp-change-${change.status}`}>
                            {change.status === 'added' ? t('version_control.files_added', '新增') :
                             change.status === 'deleted' ? t('version_control.files_deleted', '删除') :
                             t('version_control.files_modified', '修改')}
                          </span>
                          <span className="gmp-change-path">{change.path}</span>
                          <span className="gmp-change-stats">+{change.additions} -{change.deletions}</span>
                          <button
                            className="gmp-btn-small"
                            onClick={(e) => { e.stopPropagation(); handleRollback(change.path); }}
                          >
                            {t('version_control.rollback', '回滚')}
                          </button>
                        </div>
                      ))}

                      {selectedFileDiff && (
                        <div className="gmp-diff-viewer">
                          <div className="gmp-label">{selectedFileDiff.path}</div>
                          <pre className="gmp-diff-content">
                            {selectedFileDiff.hunks.map((hunk, i) => (
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
                            ))}
                          </pre>
                        </div>
                      )}
                    </>
                  )}
                  {!selectedCommit && (
                    <div className="gmp-empty">{t('version_control.select_commit_hint', '选择左侧的一个版本查看详情')}</div>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 状态 Toast */}
      <AnimatePresence>
        {status !== 'idle' && (
          <motion.div
            className={`gmp-toast gmp-toast-${status}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            {statusText}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
