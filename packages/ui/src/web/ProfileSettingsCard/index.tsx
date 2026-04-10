import React, { useState, useRef } from 'react';
import styles from './ProfileSettingsCard.module.css';
import { useTranslation } from 'react-i18next';
import { useDialog } from '../Dialog';
import { AvatarCropModal } from '../AvatarCropModal';

export interface ProfileData {
  nickname: string;
  avatarPath?: string | null;
}

export interface ProfileSettingsCardProps {
  profile: ProfileData;
  onSave: (data: ProfileData) => void;
}

export const ProfileSettingsCard: React.FC<ProfileSettingsCardProps> = ({
  profile,
  onSave
}) => {
  const { t } = useTranslation();
  const dialog = useDialog();
  const [inEditAvatar, setInEditAvatar] = useState(false);
  const [tempImageSrc, setTempImageSrc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 触发选图
  const handleTriggerPick = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (typeof ev.target?.result === 'string') {
          setTempImageSrc(ev.target.result);
          setInEditAvatar(true);
        }
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const cancelCrop = () => {
    setInEditAvatar(false);
    setTempImageSrc(null);
  };

  const finishCrop = (croppedUrl: string) => {
    onSave({ ...profile, avatarPath: croppedUrl });
    setInEditAvatar(false);
    setTempImageSrc(null);
  };

  // 编辑昵称
  const handleEditNickname = async () => {
    const promptMessage = t('profile.edit_nickname_prompt', '请输入新的昵称：');
    const nextName = await dialog.prompt(promptMessage, profile.nickname);
    if (nextName && nextName.trim() !== '' && nextName !== profile.nickname) {
      onSave({ ...profile, nickname: nextName.trim() });
    }
  };

  return (
    <>
      <div className={styles.cardContainer}>
        <div className={styles.avatarZone} onClick={handleTriggerPick}>
           {profile.avatarPath ? (
             <img className={styles.avatarImg} src={profile.avatarPath} alt="avatar" />
           ) : (
             <div className={styles.avatarFallback}>
               {(profile.nickname || '白').charAt(0).toUpperCase()}
             </div>
           )}
           <div className={styles.avatarHover}>
              📷
           </div>
           <input 
             type="file" 
             accept="image/*" 
             ref={fileInputRef} 
             style={{ display: 'none' }} 
             onChange={handleFileChange} 
           />
        </div>

        <div className={styles.infoZone}>
           <div className={styles.nameRow}>
             <button className={styles.editBtn} onClick={handleEditNickname} title={t('profile.edit_nickname', '修改昵称')}>
               ✎
             </button>
             <h2 className={styles.nickname}>{profile.nickname || t('profile.default_nickname', '白守用户')}</h2>
           </div>
        </div>
      </div>

      {inEditAvatar && tempImageSrc && (
        <AvatarCropModal 
          imageSrc={tempImageSrc}
          onCanceled={cancelCrop}
          onCropped={finishCrop}
        />
      )}
    </>
  );
};
