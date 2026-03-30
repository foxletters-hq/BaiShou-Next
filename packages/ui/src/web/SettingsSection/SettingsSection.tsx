import React from 'react';
import './SettingsSection.css';

interface SettingsSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

export const SettingsSection: React.FC<SettingsSectionProps> = ({ title, description, children }) => {
  return (
    <div className="settings-section">
      <div className="settings-section-header">
        <h3 className="settings-section-title">{title}</h3>
        {description && <p className="settings-section-desc">{description}</p>}
      </div>
      <div className="settings-section-content">
        {children}
      </div>
    </div>
  );
};
