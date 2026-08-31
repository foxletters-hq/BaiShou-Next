import React from 'react'
import { Input } from '../Input/Input'
import { GitRemoteConfigHelp } from './GitRemoteConfigHelp'
import type { GitManagementViewModel } from './useGitManagementPage'

export interface GitConfigTabProps {
  vm: GitManagementViewModel
}

export const GitConfigTab: React.FC<GitConfigTabProps> = ({ vm }) => {
  const {
    t,
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
    handleSaveAuthorConfig,
    handleSaveRemoteConfig
  } = vm

  return (
    <div className="gmp-config-form">
      <div className="gmp-config-block">
        <div className="gmp-config-block-title">
          {t('version_control.author_signature', '提交签名')}
        </div>
        <label className="gmp-label" htmlFor="gmp-author-name">
          {t('version_control.author_name', '用户名')}
        </label>
        <Input
          id="gmp-author-name"
          fieldSize="small"
          type="text"
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
          placeholder={t('version_control.author_name_hint', '例如: latte')}
        />
        <label className="gmp-label" htmlFor="gmp-author-email">
          {t('version_control.author_email', '邮箱')}
        </label>
        <Input
          id="gmp-author-email"
          fieldSize="small"
          type="text"
          value={userEmail}
          onChange={(e) => setUserEmail(e.target.value)}
          placeholder={t('version_control.author_email_hint', '例如: latte@example.com')}
        />
        <div className="gmp-btn-row">
          <button className="gmp-btn gmp-btn-primary" onClick={() => void handleSaveAuthorConfig()}>
            {t('common.save', '保存')}
          </button>
        </div>
      </div>

      <div className="gmp-config-block">
        <div className="gmp-config-block-title">
          {t('version_control.remote_config', '远程仓库')}
          <GitRemoteConfigHelp />
        </div>
        <label className="gmp-label" htmlFor="gmp-remote-url">
          {t('version_control.remote_url', '远程仓库地址')}
        </label>
        <Input
          id="gmp-remote-url"
          fieldSize="small"
          type="text"
          value={remoteUrl}
          onChange={(e) => setRemoteUrl(e.target.value)}
          placeholder={t(
            'version_control.remote_url_hint',
            '例如: https://example.com/user/vault.git'
          )}
        />
        <label className="gmp-label" htmlFor="gmp-remote-branch">
          {t('version_control.remote_branch', '远程分支')}
        </label>
        <Input
          id="gmp-remote-branch"
          fieldSize="small"
          type="text"
          value={remoteBranch}
          onChange={(e) => setRemoteBranch(e.target.value)}
          placeholder={t('version_control.remote_branch_default', '默认: main')}
        />
        <label className="gmp-label" htmlFor="gmp-remote-username">
          {t('version_control.remote_username', '远程仓库用户名')}
        </label>
        <Input
          id="gmp-remote-username"
          fieldSize="small"
          type="text"
          value={remoteUsername}
          onChange={(e) => setRemoteUsername(e.target.value)}
          placeholder={t('version_control.remote_username_hint', 'HTTPS 协议需要填写')}
        />
        <label className="gmp-label" htmlFor="gmp-remote-token">
          {t('version_control.remote_token', '密码 / 访问令牌')}
        </label>
        <Input
          id="gmp-remote-token"
          fieldSize="small"
          type={showPassword ? 'text' : 'password'}
          value={remoteToken}
          onChange={(e) => setRemoteToken(e.target.value)}
          placeholder={t('version_control.remote_token_hint', '密码或个人访问令牌')}
          trailing={
            <button
              type="button"
              className="gmp-password-toggle"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? t('common.hide', '隐藏') : t('common.show', '显示')}
            </button>
          }
        />
        <div className="gmp-btn-row">
          <button className="gmp-btn gmp-btn-primary" onClick={() => void handleSaveRemoteConfig()}>
            {t('common.save', '保存')}
          </button>
          <button className="gmp-btn" onClick={() => void handleTestRemote()}>
            {t('version_control.test_connection', '测试连接')}
          </button>
        </div>
      </div>
    </div>
  )
}
