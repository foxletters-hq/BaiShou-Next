import React from 'react';
import './SettingsItem.css';

interface SettingsItemProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  rightElement?: React.ReactNode;
  onClick?: () => void;
}

export const SettingsItem: React.FC<SettingsItemProps> = ({ 
  icon, 
  title, 
  subtitle, 
  rightElement, 
  onClick 
}) => {
  return (
    <div className={`settings-item ${onClick ? 'clickable' : ''}`} onClick={onClick}>
      {icon && <div className="settings-item-icon">{icon}</div>}
      <div className="settings-item-body">
        <div className="settings-item-title">{title}</div>
        {subtitle && <div className="settings-item-subtitle">{subtitle}</div>}
      </div>
      {rightElement && (
        <div className="settings-item-right">
          {rightElement}
        </div>
      )}
    </div>
  );
};
