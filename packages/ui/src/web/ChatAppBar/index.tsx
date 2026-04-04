import React, { useState, useRef, useEffect } from 'react';
import styles from './ChatAppBar.module.css';
import { useTranslation } from 'react-i18next';
import { Trash2, BrainCircuit, Settings, Bot, MoreVertical, Edit2 } from 'lucide-react';

export interface AgentProfile {
  name: string;
  avatarPath?: string | null;
  emoji?: string | null;
  modelIdentifier?: string; // 例如 "GPT-4o"
  tokenSize?: string;       // 例如 "128k"
}

export interface ChatAppBarProps {
  profile: AgentProfile;
  onClearChat?: () => void;
  onOpenMemory?: () => void;
  onOpenSettings?: () => void;
  onRenameChat?: (newName: string) => void;
  isDesktopClient?: boolean;
}

export const ChatAppBar: React.FC<ChatAppBarProps> = ({
  profile,
  onClearChat,
  onOpenMemory,
  onOpenSettings,
  onRenameChat,
  isDesktopClient = false,
}) => {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(profile.name);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
  setEditName(profile.name);
  }, [profile.name]);

  useEffect(() => {
  const handleClickOutside = (e: MouseEvent) => {
  if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const submitRename = () => {
  setIsEditing(false);
    if (editName.trim() && editName.trim() !== profile.name) {


      onRenameChat?.(editName.trim());
    } else {
      setEditName(profile.name);
    }
  };

  const Avatar = () => (
    <div className={styles.avatarWrap}>
      {profile.avatarPath ? (
        <img src={profile.avatarPath} alt={profile.name} className={styles.avatarImg} />
      ) : profile.emoji ? (
        <div className={styles.avatarFallback}>{profile.emoji}</div>
      ) : (
        <div className={styles.avatarFallback}>
          <Bot size={20} strokeWidth={2.5} />
        </div>
      )}
    </div>
  );

  return (
    <div className={`${styles.container} ${isDesktopClient ? styles.appRegionDrag : ''}`}>
       <div className={styles.leftSection}>
          <Avatar />
          <div className={styles.infoCol}>
             {isEditing ? (
               <input 
                 ref={inputRef}
                 className={styles.nameInput}
                 value={editName}
                 onChange={e => setEditName(e.target.value)}
                 onBlur={submitRename}
                 onKeyDown={e => e.key === 'Enter' && submitRename()}
                 autoFocus
               />
             ) : (
               <div className={styles.nameWrap} onDoubleClick={() => setIsEditing(true)}>
                 <span className={styles.name}>{profile.name}</span>
                 <button className={styles.inlineEditBtn} onClick={() => setIsEditing(true)} aria-label="Edit rename">
                    <Edit2 size={12} />
                 </button>
               </div>
             )}
             {/* Info Badges */}
             {(profile.modelIdentifier || profile.tokenSize) && (
               <div className={styles.badges}>
                  {profile.modelIdentifier && (
                    <span className={styles.badgeModel}>✨ {profile.modelIdentifier}</span>
                  )}
                  {profile.tokenSize && (
                    <span className={styles.badgeToken}>{profile.tokenSize} Tokens</span>
                  )}
               </div>
             )}
          </div>
       </div>

       <div className={`${styles.rightSection} ${isDesktopClient ? styles.appRegionNoDrag : ''}`}>
          {onOpenMemory && (
            <button className={styles.actionBtn} onClick={onOpenMemory} title={t('agent.chat.memory', 'AI 记忆')}>
               <BrainCircuit size={18} />
            </button>
          )}
          {onOpenSettings && (
            <button className={styles.actionBtn} onClick={onOpenSettings} title={t('common.settings', '配置')}>
               <Settings size={18} />
            </button>
          )}
          {onClearChat && (
            <button className={`${styles.actionBtn} ${styles.dangerBtn}`} onClick={onClearChat} title={t('common.clear', '清空历史')}>
               <Trash2 size={18} />
            </button>
          )}
       </div>
    </div>
  );
};
