import React, { useState } from 'react';
import styles from './ProfileSettingsCard.module.css';

interface ProfileData {
  nickname: string;
  avatarUrl?: string;
  autoSync: boolean;
}

interface ProfileSettingsCardProps {
  profile: ProfileData;
  onSave: (data: ProfileData) => void;
  onGenerateAvatar?: () => void;
}

export const ProfileSettingsCard: React.FC<ProfileSettingsCardProps> = ({
  profile,
  onSave,
  onGenerateAvatar
}) => {
  const [formData, setFormData] = useState<ProfileData>(profile);

  const handleSave = () => {
     onSave(formData);
  };

  return (
     <div className={styles.card}>
        <div className={styles.header}>
           <h3>个人资料</h3>
           <p>管理您的数字显影与同步配置</p>
        </div>

        <div className={styles.body}>
           <div className={styles.avatarSection}>
              <div className={styles.avatarPreview}>
                 {formData.avatarUrl ? (
                   <img src={formData.avatarUrl} alt="avatar" />
                 ) : (
                   <span className={styles.avatarFallback}>
                     {formData.nickname.charAt(0).toUpperCase() || 'U'}
                   </span>
                 )}
                 <div className={styles.avatarHoverWrapper}>
                    <button className={styles.uploadBtn}>📁 上传</button>
                    {onGenerateAvatar && (
                        <button className={styles.generateBtn} onClick={onGenerateAvatar}>
                           ✨ AI 生成
                        </button>
                    )}
                 </div>
              </div>
              <div className={styles.avatarTip}>
                 建议使用 256x256 px 的透明背景图片
              </div>
           </div>

           <div className={styles.formSection}>
              <div className={styles.formGroup}>
                 <label>用户昵称</label>
                 <input 
                   type="text" 
                   value={formData.nickname}
                   onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                   className={styles.inputField}
                 />
              </div>

              <div className={styles.formGroupRow}>
                 <div className={styles.switchLabel}>
                    <span className={styles.title}>局域网自动同步</span>
                    <span className={styles.subtitle}>在同一网络下静默同步至其他终端</span>
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
        </div>

        <div className={styles.footer}>
           <button 
             className={styles.saveBtn} 
             onClick={handleSave}
             disabled={formData === profile} // Disable if no changes
           >
             保存更改
           </button>
        </div>
     </div>
  );
};
