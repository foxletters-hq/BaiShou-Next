import React from 'react'
import { motion } from 'framer-motion'
import { HelpCircle } from 'lucide-react'
import { Tooltip } from '../Tooltip/Tooltip'
import { GitRemoteConfigHelp } from './GitRemoteConfigHelp'
import type { GitManagementViewModel } from './useGitManagementPage'
import { GitConflictSection } from './GitConflictSection'

export interface GitConfigTabProps {
  vm: GitManagementViewModel
}

export const GitConfigTab: React.FC<GitConfigTabProps> = ({ vm }) => {
  const {
    t,
    isInitialized,
    handleInit,
    userName,
    setUserName,
    userEmail,
    setUserEmail,
    remoteUrl,
    setRemoteUrl,
    remoteBranch,
    setRemoteBranch,
    remoteUsername,
    setRemoteUsername,
    remoteToken,
    setRemoteToken,
    showPassword,
    setShowPassword,
    handleTestRemote,
    handlePush,
    handlePull,
    handleSaveAuthorConfig,
    handleSaveRemoteConfig
  } = vm

  return (
    <motion.div
      key="config"
      className="gmp-content"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
    >
      {!isInitialized && (
        <div className="gmp-section">
          <div className="gmp-section-header" style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="gmp-label" style={{ marginBottom: 0 }}>
                {t('version_control.git_status', 'Git 仓库状态')}
              </span>
              <Tooltip
                content={t(
                  'version_control.git_status_tooltip',
                  'Git 用于本地数据版本控制，支持记录修改历史、推送到远程 Git 仓库（如 GitHub/Gitee）进行备份，以及多设备间同步。如果您在操作同步或备份恢复功能时误恢复了错误版本，可通过版本控制进行回滚或撤销变更，防止数据丢失。本功能仅在桌面端提供，移动端出于性能与平台限制未予支持。'
                )}
              >
                <HelpCircle
                  size={14}
                  style={{ color: 'var(--text-tertiary)', cursor: 'pointer' }}
                />
              </Tooltip>
            </div>
          </div>
          <button className="gmp-btn gmp-btn-primary" onClick={handleInit}>
            {t('version_control.init_git', '初始化 Git 仓库')}
          </button>
        </div>
      )}
      {isInitialized && (
        <>
          <div className="gmp-section">
            <div className="gmp-section-header" style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="gmp-label" style={{ marginBottom: 0 }}>
                  {t('version_control.git_status', 'Git 仓库状态')}
                </span>
                <Tooltip
                  content={t(
                    'version_control.git_status_tooltip',
                    'Git 用于本地数据版本控制，支持记录修改历史、推送到远程 Git 仓库（如 GitHub/Gitee）进行备份，以及多设备间同步。如果您在操作同步或备份恢复功能时误恢复了错误版本，可通过版本控制进行回滚或撤销变更，防止数据丢失。本功能仅在桌面端提供，移动端出于性能与平台限制未予支持。'
                  )}
                >
                  <HelpCircle
                    size={14}
                    style={{ color: 'var(--text-tertiary)', cursor: 'pointer' }}
                  />
                </Tooltip>
              </div>
              <span style={{ fontSize: 13, color: 'var(--color-primary)' }}>
                {t('version_control.git_enabled', '已启用')}
              </span>
            </div>
          </div>

          {/* Git 提交签名 */}
          <div className="gmp-section">
            <div className="gmp-section-header" style={{ marginBottom: 12 }}>
              <span className="gmp-label" style={{ marginBottom: 0 }}>
                {t('version_control.author_signature', 'Git 提交签名')}
              </span>
              <button className="gmp-btn gmp-btn-primary" onClick={handleSaveAuthorConfig}>
                {t('common.save', '保存')}
              </button>
            </div>
            <div className="gmp-label">
              {t('version_control.author_name', '用户名 (user.name)')}
            </div>
            <input
              className="gmp-input"
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder={t('version_control.author_name_hint', '例如: latte')}
            />
            <div className="gmp-label" style={{ marginTop: 12 }}>
              {t('version_control.author_email', '邮箱 (user.email)')}
            </div>
            <input
              className="gmp-input"
              type="text"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              placeholder={t('version_control.author_email_hint', '例如: latte@example.com')}
            />
          </div>

          {/* 远程仓库配置 */}
          <div className="gmp-section">
            <div className="gmp-section-header" style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="gmp-label" style={{ marginBottom: 0 }}>
                  {t('version_control.remote_config', '远程仓库配置')}
                </span>
                <GitRemoteConfigHelp />
              </div>
              <button className="gmp-btn gmp-btn-primary" onClick={handleSaveRemoteConfig}>
                {t('common.save', '保存')}
              </button>
            </div>
            <div className="gmp-label">{t('version_control.remote_url', '远程仓库地址')}</div>
            <input
              className="gmp-input"
              type="text"
              value={remoteUrl}
              onChange={(e) => setRemoteUrl(e.target.value)}
              placeholder={t(
                'version_control.remote_url_hint',
                '例如: https://github.com/username/vault.git'
              )}
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
            <div className="gmp-label" style={{ marginTop: 12 }}>
              {t('version_control.remote_username', '远程仓库用户名')}
            </div>
            <input
              className="gmp-input"
              type="text"
              value={remoteUsername}
              onChange={(e) => setRemoteUsername(e.target.value)}
              placeholder={t(
                'version_control.remote_username_hint',
                '例如: github-user (仅 HTTPS 协议需要)'
              )}
            />
            <div className="gmp-label" style={{ marginTop: 12 }}>
              {t('version_control.remote_token', '密码 / Access Token')}
            </div>
            <div style={{ position: 'relative' }}>
              <input
                className="gmp-input"
                type={showPassword ? 'text' : 'password'}
                value={remoteToken}
                onChange={(e) => setRemoteToken(e.target.value)}
                placeholder={t('version_control.remote_token_hint', '密码或个人访问令牌 (Token)')}
                style={{ paddingRight: '50px' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: '12px',
                  padding: '4px'
                }}
              >
                {showPassword ? t('common.hide', '隐藏') : t('common.show', '显示')}
              </button>
            </div>
            <div className="gmp-btn-row" style={{ marginTop: 16 }}>
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
        </>
      )}
      <GitConflictSection vm={vm} />
    </motion.div>
  )
}
