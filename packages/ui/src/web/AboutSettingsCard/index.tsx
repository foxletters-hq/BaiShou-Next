import React from 'react';
import { useTranslation } from 'react-i18next';
import { MdOutlineInfo, MdOutlinePrivacyTip, MdOutlineBugReport, MdChevronRight } from 'react-icons/md';
import '../shared/SettingsListTile.css';

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
  const { t } = useTranslation();

  return (
    <div>
      {/* 关于白守 */}
      <button className="settings-list-tile">
        <div className="settings-list-tile-leading">
          <MdOutlineInfo size={24} />
        </div>
        <div className="settings-list-tile-content">
          <span className="settings-list-tile-title">{t('settings.about_baishou', '关于白守')}</span>
          <span className="settings-list-tile-subtitle">{version}</span>
        </div>
        <MdChevronRight size={22} className="settings-list-tile-trailing" />
      </button>

      <div className="settings-list-divider" />

      {/* 开发哲学 */}
      <button className="settings-list-tile" onClick={onOpenPrivacyPolicy}>
        <div className="settings-list-tile-leading">
          <MdOutlinePrivacyTip size={24} />
        </div>
        <div className="settings-list-tile-content">
          <span className="settings-list-tile-title">{t('settings.development_philosophy', '开发哲学与无痕承诺')}</span>
        </div>
        <MdChevronRight size={22} className="settings-list-tile-trailing" />
      </button>

      <div className="settings-list-divider" />

      {/* 反馈 */}
      <button className="settings-list-tile" onClick={onOpenGithubHost}>
        <div className="settings-list-tile-leading">
          <MdOutlineBugReport size={24} />
        </div>
        <div className="settings-list-tile-content">
          <span className="settings-list-tile-title">{t('settings.feedback', '问题反馈')}</span>
        </div>
        <MdChevronRight size={22} className="settings-list-tile-trailing" />
      </button>
    </div>
  );
};
