import React, { useState } from 'react';
import styles from './ProfileSettingsCard.module.css';

export interface ProfileData {
  nickname: string;
  avatarUrl?: string;
  autoSync: boolean;
}

export interface ProfileSettingsCardProps {
  profile: ProfileData;
  onSave: (data: ProfileData) => void;
  onGenerateAvatar?: () => void;
  onPickAvatar?: () => void;
}

export const ProfileSettingsCard: React.FC<ProfileSettingsCardProps> = ({
  profile,
  onSave,
  onGenerateAvatar,
  onPickAvatar
}) => {
  const [formData, setFormData] = useState<ProfileData>(profile);

  const handleSave = () => {
    onSave(formData);
  };

  const isChanged = JSON.stringify(formData) !== JSON.stringify(profile);

  return (
    <div className={styles.container}>
      <div className={styles.avatarSection}>
        <div className={styles.avatarPreview}>
          {formData.avatarUrl ? (
            <img src={formData.avatarUrl} alt="avatar" />
          ) : (
            <span className={styles.avatarFallback}>
              {formData.nickname.charAt(0).toUpperCase() || 'U'}
            </span>
          )}
        </div>
        <div className={styles.avatarInfo}>
          <p>建议使用 256x256 px 的透明背景图片</p>
          <div className={styles.btnGroup}>
            <button className={styles.uploadBtn} onClick={onPickAvatar}>
              📁 浏览本地
            </button>
            {onGenerateAvatar && (
              <button className={styles.generateBtn} onClick={onGenerateAvatar}>
                ✨ AI 生成
              </button>
            )}
          </div>
        </div>
      </div>

      <div className={styles.formSection}>
        <div className={styles.formGroup}>
          <label>用户主昵称</label>
          <input 
            type="text" 
            value={formData.nickname}
            onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
            className={styles.inputField}
            placeholder="输入您在系统中的显示名称"
          />
        </div>

        <div className={styles.formGroupRow}>
          <div className={styles.switchLabel}>
            <span className={styles.title}>跨端无感同步档案</span>
            <span className={styles.subtitle}>在局域网内自动推流并覆盖分身名片</span>
          </div>
          <label className={styles.switch}>
            <input 
              type="checkbox" 
              checked={formData.autoSync}
              onChange={(e) => setFormData({ ...formData, autoSync: e.target.checked })}
            />
            <span className={styles.slider}></span>
          </label>
        </div>
      </div>

      <div className={styles.footer}>
        <button 
          className={styles.saveBtn} 
          onClick={handleSave}
          disabled={!isChanged}
        >
          保存更改
        </button>
      </div>
    </div>
  );
};
