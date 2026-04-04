import React from 'react';
import styles from './IdentitySettingsCard.module.css';
import { useTranslation } from 'react-i18next';
import { useDialog } from '../Dialog';
import { useToast } from '../Toast/useToast';
import { 
  MdOutlineBadge, 
  MdOutlineAddCircleOutline, 
  MdClose, 
  MdAdd, 
  MdOutlinePersonAddAlt1, 
  MdOutlineLabel, 
  MdOutlineEdit, 
  MdOutlineDeleteOutline 
} from 'react-icons/md';

export interface UserProfileConfig {
  nickname: string;
  avatarPath?: string;
  activePersonaId: string;
  personas: Record<string, { id: string; facts: Record<string, string> }>;
}

export interface IdentitySettingsCardProps {
  profile: UserProfileConfig;
  onChange: (profile: UserProfileConfig) => void;
}

export const IdentitySettingsCard: React.FC<IdentitySettingsCardProps> = ({ profile, onChange }) => {
  const { t } = useTranslation();
  const dialog = useDialog();
  const toast = useToast();
  
  const activeId = profile.activePersonaId || 'Default';
  // 确保 fallback
  const allPersonas = profile.personas || { 'Default': { id: 'Default', facts: {} } };
  
  if (!allPersonas[activeId]) {
    allPersonas[activeId] = { id: activeId, facts: {} };
  }
  
  const currentFacts = allPersonas[activeId].facts || {};

  // 1. 切换活动 Persona
  const handleSwitch = async (pid: string) => {
    if (pid !== activeId) {
      onChange({ ...profile, activePersonaId: pid });
    } else {
      // 点击了当前的，可以重命名
      const newName = await dialog.prompt(t('settings.rename_identity_card', "重命名身份卡"), pid);
      if (newName && newName !== pid && !allPersonas[newName]) {
        const nextPersonas = { ...allPersonas };
        nextPersonas[newName] = { ...nextPersonas[pid], id: newName };
        delete nextPersonas[pid];
        onChange({ ...profile, personas: nextPersonas, activePersonaId: newName });
      }
    }
  };

  // 2. 新增 Persona
  const handleAddPersona = async () => {
    const newName = await dialog.prompt(t('settings.new_identity_card', "新建身份卡"), "");
    if (newName && !allPersonas[newName]) {
      const nextPersonas = { ...allPersonas, [newName]: { id: newName, facts: {} } };
      onChange({ ...profile, personas: nextPersonas, activePersonaId: newName });
    }
  };

  // 3. 删除当前 Persona
  const handleDeletePersona = async (pid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (Object.keys(allPersonas).length <= 1) {
      toast.showError(t('settings.identity_min_one', "至少保留一张身份卡！"));
      return;
    }
    const confirmed = await dialog.confirm(t('settings.delete_identity_card', '确定删除身份卡 [{{pid}}] 吗？', { pid }));
    if (confirmed) {
      const nextPersonas = { ...allPersonas };
      delete nextPersonas[pid];
      const remainingIds = Object.keys(nextPersonas);
      onChange({ ...profile, personas: nextPersonas, activePersonaId: remainingIds[0] });
    }
  };

  // 4. 增改 Fact
  const handleAddOrEditFact = async (oldKey?: string, oldVal?: string) => {
    const isEditing = !!oldKey;
    const title = isEditing 
      ? t('settings.edit_identity_entry', "编辑特征点") 
      : t('settings.add_identity_entry', "新增特征点");
    const k = await dialog.prompt(`${title} - 属性名 (例如：年纪、职业)`, oldKey || "");
    if (!k) return;
    const v = await dialog.prompt(`属性 [${k}] 的值 (例如：永远的18岁)`, oldVal || "");
    if (!v) return;

    const nextFacts = { ...currentFacts };
    if (oldKey && oldKey !== k) {
      delete nextFacts[oldKey];
    }
    nextFacts[k] = v;

    onChange({
      ...profile,
      personas: { ...allPersonas, [activeId]: { ...allPersonas[activeId], facts: nextFacts } }
    });
  };

  // 5. 删 Fact
  const handleDeleteFact = async (k: string) => {
    const confirmed = await dialog.confirm(t('settings.delete_identity_confirm', '确认删除属性 {{k}}？', { k }));
    if (confirmed) {
      const nextFacts = { ...currentFacts };
      delete nextFacts[k];
      onChange({
        ...profile,
        personas: { ...allPersonas, [activeId]: { ...allPersonas[activeId], facts: nextFacts } }
      });
    }
  };

  return (
    <div className={styles.flutterCardContainer}>
      {/* 头部标题区 */}
      <div className={styles.headerRow}>
        <div className={styles.headerTitleGroup}>
          <MdOutlineBadge size={20} className={styles.primaryIcon} />
          <span className={styles.headerText}>{t('settings.identity_card', '身份卡')}</span>
        </div>
        <button 
          className={styles.iconIconButton}
          title={t('settings.add_identity_entry', '新增特征点')}
          onClick={() => handleAddOrEditFact()}
        >
          <MdOutlineAddCircleOutline size={20} />
        </button>
      </div>
      
      {/* 描述信息 */}
      <div className={styles.descriptionText}>
        {t('settings.identity_card_desc', '助手将自动结合这些核心词条构筑角色认知与您对话。')}
      </div>

      {/* 动态 Chips 选项卡 */}
      <div className={styles.chipsScrollArea}>
        <div className={styles.chipsContainer}>
          {Object.keys(allPersonas).map(pid => {
            const isActive = pid === activeId;
            return (
              <div 
                key={pid} 
                className={`${styles.inputChip} ${isActive ? styles.inputChipActive : ''}`}
                onClick={() => handleSwitch(pid)}
              >
                <span>{pid}</span>
                {isActive && Object.keys(allPersonas).length > 1 && (
                  <button className={styles.chipCloseBtn} onClick={(e) => handleDeletePersona(pid, e)}>
                    <MdClose size={14} />
                  </button>
                )}
              </div>
            );
          })}
          <div className={styles.actionChip} onClick={handleAddPersona}>
            <MdAdd size={16} />
            <span>{t('settings.new_identity', '新身份')}</span>
          </div>
        </div>
      </div>

      {/* 核心词条区域 */}
      {Object.keys(currentFacts).length === 0 ? (
        <div className={styles.emptyContainer}>
          <MdOutlinePersonAddAlt1 size={32} />
          <span>{t('settings.identity_card_empty_hint', '当前身份为空白，不妨添加一些基本特征描述吧。')}</span>
        </div>
      ) : (
        <div className={styles.factsList}>
          {Object.entries(currentFacts).map(([k, v]) => (
            <div key={k} className={styles.factListTile}>
              <div className={styles.factLeading}>
                <MdOutlineLabel size={18} className={styles.primaryIcon} />
              </div>
              <div className={styles.factContent}>
                <span className={styles.factKey}>{k}</span>
                <span className={styles.factValue}>{v}</span>
              </div>
              <div className={styles.factTrailing}>
                <button className={styles.iconIconButton} onClick={() => handleAddOrEditFact(k, v)}>
                  <MdOutlineEdit size={16} />
                </button>
                <button className={`${styles.iconIconButton} ${styles.dangerIcon}`} onClick={() => handleDeleteFact(k)}>
                  <MdOutlineDeleteOutline size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
