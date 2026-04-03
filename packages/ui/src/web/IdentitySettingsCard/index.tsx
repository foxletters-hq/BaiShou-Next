import React from 'react';
import styles from './IdentitySettingsCard.module.css';
import { useTranslation } from 'react-i18next';


export interface UserProfileConfig {
  nickname: string;
  avatarPath: string;
  activePersonaId: string;
  personas: Record<string, Record<string, string>>;
}

export interface IdentitySettingsCardProps {
  profile: UserProfileConfig;
  onChange: (profile: UserProfileConfig) => void;
}

export const IdentitySettingsCard: React.FC<IdentitySettingsCardProps> = ({ profile, onChange }) => {
  const { t } = useTranslation();
  const activeId = profile.activePersonaId || 'Default';
  // 确保 fallback
  const allPersonas = profile.personas || { 'Default': {} };
  
  if (!allPersonas[activeId]) {
    allPersonas[activeId] = {};
  }
  
  const currentFacts = allPersonas[activeId];

  // 1. 切换活动 Persona
  const handleSwitch = (pid: string) => {
    if (pid !== activeId) {
      onChange({ ...profile, activePersonaId: pid });
    } else {
      // 点击了当前的，可以重命名
      const newName = window.prompt("重新命名的身份名", pid);
      if (newName && newName !== pid && !allPersonas[newName]) {
        const nextPersonas = { ...allPersonas };
        nextPersonas[newName] = nextPersonas[pid];
        delete nextPersonas[pid];
        onChange({ ...profile, personas: nextPersonas, activePersonaId: newName });
      }
    }
  };

  // 2. 新增 Persona
  const handleAddPersona = () => {
    const newName = window.prompt("输入新的身份卡名字 (例如：前端专家、法律顾问)");
    if (newName && !allPersonas[newName]) {
      const nextPersonas = { ...allPersonas, [newName]: {} };
      onChange({ ...profile, personas: nextPersonas, activePersonaId: newName });
    }
  };

  // 3. 删除当前 Persona
  const handleDeletePersona = (pid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (Object.keys(allPersonas).length <= 1) {
      alert("至少保留一张身份卡！");
      return;
    }
    if (window.confirm(t('identity.delete_persona', '确定删除身份档案 [{{pid}}] 吗？', { pid }))) {
      const nextPersonas = { ...allPersonas };
      delete nextPersonas[pid];
      const remainingIds = Object.keys(nextPersonas);
      onChange({ ...profile, personas: nextPersonas, activePersonaId: remainingIds[0] });
    }
  };

  // 4. 增改 Fact
  const handleAddOrEditFact = (oldKey?: string, oldVal?: string) => {
    const k = window.prompt("键 (例如：年纪、喜好)", oldKey || "");
    if (!k) return;
    const v = window.prompt(`[${k}] 的值 (例如：永远的18岁)`, oldVal || "");
    if (!v) return;

    const nextFacts = { ...currentFacts };
    if (oldKey && oldKey !== k) {
      delete nextFacts[oldKey];
    }
    nextFacts[k] = v;

    onChange({
      ...profile,
      personas: { ...allPersonas, [activeId]: nextFacts }
    });
  };

  // 5. 删 Fact
  const handleDeleteFact = (k: string) => {
    if (window.confirm(t('identity.delete_record', '确认删除记录 {{k}}？', { k }))) {
      const nextFacts = { ...currentFacts };
      delete nextFacts[k];
      onChange({
        ...profile,
        personas: { ...allPersonas, [activeId]: nextFacts }
      });
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleLine}>
          <div className={styles.titleLeft}>
            <span className={styles.icon}>🎭</span>
            <h3 className={styles.title}>{t('identity.personas_title', '预设核心档案 (Personas & Facts)')}</h3>
          </div>
          <button className={styles.addFactBtn} onClick={() => handleAddOrEditFact()}>
            + {t('identity.add_fact', '补充属性链条')}
          </button>
        </div>
        <p className={styles.subtitle}>{t('identity.personas_desc', '助手将自动组合这些底层的核心认知词条与您对答。')}</p>
      </div>

      <div className={styles.chipRow}>
        {Object.keys(allPersonas).map(pid => {
          const isActive = pid === activeId;
          return (
            <div 
              key={pid} 
              className={`${styles.chip} ${isActive ? styles.chipActive : ''}`}
              onClick={() => handleSwitch(pid)}
            >
              {pid}
              {isActive && Object.keys(allPersonas).length > 1 && (
                <span className={styles.chipDel} onClick={(e) => handleDeletePersona(pid, e)}>✕</span>
              )}
            </div>
          );
        })}
        <button className={styles.addChipBtn} onClick={handleAddPersona}>+ {t('identity.add_persona', '预设档')}</button>
      </div>

      <div className={styles.factsArea}>
        {Object.entries(currentFacts).length === 0 ? (
          <div className={styles.emptyFacts}>
            <span className={styles.emptyIcon}>🧬</span>
            <p>{t('identity.empty_persona', '当前配置项为空')}</p>
          </div>
        ) : (
          Object.entries(currentFacts).map(([k, v]) => (
            <div key={k} className={styles.factRow}>
              <div className={styles.factKey}>{k}</div>
              <div className={styles.factVal}>{v}</div>
              <div className={styles.factActions}>
                <button title="编辑" onClick={() => handleAddOrEditFact(k, v)}>✎</button>
                <button title="删除" className={styles.delBtn} onClick={() => handleDeleteFact(k)}>✕</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
