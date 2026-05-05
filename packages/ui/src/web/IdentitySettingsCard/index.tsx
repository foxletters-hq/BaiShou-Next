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
  MdOutlineDeleteOutline,
  MdCheck,
  MdExpandMore,
  MdExpandLess
} from 'react-icons/md';
import { Modal } from '../Modal/Modal';
import { Button } from '../Button/Button';
import { Input } from '../Input/Input';

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
  const [collapsed, setCollapsed] = React.useState(true);

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

  const [editingKey, setEditingKey] = React.useState<string | null>(null);
  const [isFactModalOpen, setIsFactModalOpen] = React.useState(false);
  const [editKeyInput, setEditKeyInput] = React.useState('');
  const [editValInput, setEditValInput] = React.useState('');

  const startEdit = (k: string, v: string) => {
    setEditingKey(k);
    setEditKeyInput(k);
    setEditValInput(v);
    setIsFactModalOpen(true);
  };

  const handleAddFact = () => {
    setEditingKey(null);
    setEditKeyInput('');
    setEditValInput('');
    setIsFactModalOpen(true);
  };

  const saveEdit = () => {
    const k = editKeyInput.trim();
    const v = editValInput.trim();
    if (!k || !v) {
      toast.showError(t('settings.empty_fact_error', '键名和键值不能为空'));
      return;
    }
    
    if (k !== editingKey && currentFacts[k]) {
      toast.showError(t('settings.duplicate_fact_error', '该特征键名已存在'));
      return;
    }

    const nextFacts = { ...currentFacts };
    if (editingKey && editingKey !== k) {
      delete nextFacts[editingKey];
    }
    nextFacts[k] = v;
    onChange({
      ...profile,
      personas: { ...allPersonas, [activeId]: { ...allPersonas[activeId], facts: nextFacts } }
    });
    setIsFactModalOpen(false);
  };

  // 3. 删除当前 Persona
  const handleDeletePersona = async (pid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (Object.keys(allPersonas).length <= 1) {
      toast.showError(t('settings.identity_min_one', "至少保留一张身份卡！"));
      return;
    }
    const confirmed = await dialog.confirm(t('settings.delete_identity_card', '确定删除身份卡: $personaId').replace('$personaId', pid));
    if (confirmed) {
      const nextPersonas = { ...allPersonas };
      delete nextPersonas[pid];
      const remainingIds = Object.keys(nextPersonas);
      onChange({ ...profile, personas: nextPersonas, activePersonaId: remainingIds[0] });
    }
  };

  // Removed handleAddFact direct insertion as it's handled by handleAddFact + saveEdit now.

  // 5. 删 Fact
  const handleDeleteFact = async (k: string) => {
    const confirmed = await dialog.confirm(t('settings.delete_identity_confirm', '确认删除「$key」？').replace('$key', k));
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
      <div className={`${styles.headerRow} ${styles.headerRowHover}`} onClick={() => setCollapsed(!collapsed)}>
        <div className={styles.headerTitleGroup} style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
            <MdOutlineBadge size={20} className={styles.primaryIcon} />
            <span className={styles.headerText}>{t('settings.identity_card', '身份卡')}</span>
            <span className={styles.headerFactCount}>{Object.keys(currentFacts).length} {t('settings.items', '条')}</span>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {collapsed ? <MdExpandMore size={20} style={{ color: 'var(--text-tertiary)' }} /> : <MdExpandLess size={20} style={{ color: 'var(--text-tertiary)' }} />}
          </div>
        </div>
      </div>
      
      {/* 可折叠内容区域 — 用 CSS grid 动画实现平滑展开/收起 */}
      <div className={`${styles.collapseWrapper} ${collapsed ? '' : styles.collapseOpen}`}>
        <div className={styles.collapseInner}>
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
          <div className={styles.factsContainer}>
            <div className={styles.factsHeader}>
              <span className={styles.factsHeaderTitle}>{t('settings.identity_facts_title', '属性设置')}</span>
              <button 
                className={styles.addFactButton}
                onClick={handleAddFact}
              >
                <MdAdd size={16} />
                {t('settings.add_identity_entry_btn', '添加属性')}
              </button>
            </div>
            
            {Object.keys(currentFacts).length === 0 ? (
              <div className={styles.emptyContainer}>
                <MdOutlinePersonAddAlt1 size={32} />
                <span>{t('settings.identity_card_empty_hint', '当前身份为空白，不妨添加一些基本特征描述吧。')}</span>
              </div>
            ) : (
            <div className={styles.factsList}>
              {Object.entries(currentFacts).map(([k, v]) => {
                return (
                  <div key={k} className={styles.factListTile}>
                    <div className={styles.factLeading}>
                      <MdOutlineLabel size={18} className={styles.primaryIcon} />
                    </div>
                    
                    <div className={styles.factContent}>
                      <span className={styles.factKey}>{k}</span>
                      <span className={styles.factValue}>{v}</span>
                    </div>
                    
                    <div className={styles.factTrailing}>
                      <button className={styles.iconIconButton} onClick={() => startEdit(k, v)}>
                        <MdOutlineEdit size={16} />
                      </button>
                      <button className={`${styles.iconIconButton} ${styles.dangerIcon}`} onClick={() => handleDeleteFact(k)}>
                        <MdOutlineDeleteOutline size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            )}
          </div>
        </div>
      </div>

      <Modal 
        isOpen={isFactModalOpen} 
        onClose={() => setIsFactModalOpen(false)} 
        title={editingKey ? t('settings.edit_fact', '编辑特征') : t('settings.new_fact', '新增特征')}
      >
         <div className={styles.modalBody}>
            <div className={styles.modalField}>
               <label>{t('settings.fact_key', '特征名')}</label>
               <Input 
                 value={editKeyInput} 
                 onChange={e => setEditKeyInput(e.target.value)} 
                 placeholder={t('settings.fact_key_placeholder', '如：年龄、性格、身份')}
                 autoFocus 
               />
            </div>
            <div className={styles.modalField}>
               <label>{t('settings.fact_value', '特征值')}</label>
               <Input 
                 value={editValInput} 
                 onChange={e => setEditValInput(e.target.value)} 
                 placeholder={t('settings.fact_value_placeholder', '如：25岁、傲娇、魔法使')}
                 onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                   if (e.key === 'Enter') saveEdit();
                 }}
               />
            </div>
            <div className={styles.modalActions}>
               <Button variant="text" onClick={() => setIsFactModalOpen(false)}>{t('common.cancel', '取消')}</Button>
               <Button variant="elevated" onClick={saveEdit}>{t('common.save', '保存')}</Button>
            </div>
         </div>
      </Modal>
    </div>
  );
};
