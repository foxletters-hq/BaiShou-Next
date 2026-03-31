import React from 'react';
import styles from './AboutSettingsCard.module.css';

export interface AboutSettingsCardProps {
  version: string;
  onOpenPrivacyPolicy: () => void;
  onOpenGithubHost: () => void;
}

export const AboutSettingsCard: React.FC<AboutSettingsCardProps> = ({
  version,
  onOpenPrivacyPolicy,
  onOpenGithubHost,
}) => {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.logoBlock}>
          <div className={styles.logoIcon}>🛡️</div>
          <div className={styles.logoText}>
            <h1>白守 (BaiShou Next)</h1>
            <span className={styles.versionBadge}>{version}</span>
          </div>
        </div>
        <p className={styles.desc}>
          下一代全链路本地优先的极客终端系统。您的思维火花，由您自己捍卫。
        </p>
      </div>

      <div className={styles.linksRow}>
        <button className={styles.actionBtn} onClick={onOpenPrivacyPolicy}>
          <span className={styles.btnIcon}>📜</span> 开发哲学与无痕承诺
        </button>
        <button className={styles.actionBtn} onClick={onOpenGithubHost}>
          <span className={styles.btnIcon}>🐙</span> GitHub 开源协议与建议反馈
        </button>
      </div>
    </div>
  );
};
