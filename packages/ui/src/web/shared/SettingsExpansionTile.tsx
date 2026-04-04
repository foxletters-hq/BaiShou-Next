import React, { useState, useEffect } from 'react';
import { MdExpandMore } from 'react-icons/md';
import './SettingsListTile.css';

export interface SettingsExpansionTileProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  nested?: boolean;
  children: React.ReactNode;
}

export const SettingsExpansionTile: React.FC<SettingsExpansionTileProps> = ({
  icon,
  title,
  subtitle,
  nested = false,
  children
}) => {
  const [open, setOpen] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (open) {
      setShouldRender(true);
    } else {
      timer = setTimeout(() => setShouldRender(false), 350); // Match CSS transition duration
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [open]);

  return (
    <div className={`settings-expansion-tile ${nested ? 'settings-nested' : ''} ${open ? 'settings-open' : ''}`}>
      <button className="settings-expansion-summary" onClick={() => setOpen(!open)}>
        {icon && <div className="settings-list-tile-leading">{icon}</div>}
        <div className="settings-list-tile-content">
          <span className="settings-list-tile-title">{title}</span>
          {subtitle && <span className="settings-list-tile-subtitle">{subtitle}</span>}
        </div>
        <MdExpandMore className="settings-expansion-arrow" size={24} />
      </button>

      {/* Uses modern CSS Grid transition for bidirectional smooth height animation + delayed unmount */}
      <div className={`settings-expansion-grid-wrapper ${open ? 'expanded' : ''}`}>
        <div className="settings-expansion-grid-item">
          {shouldRender && (
            <div className="settings-expansion-content">
              {children}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
