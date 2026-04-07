import React, { useState } from 'react';
import styles from './SummarySettingsView.module.css';
import { useTranslation } from 'react-i18next';
import { useToast } from '../Toast/useToast';
import { MilkdownEditorWrapper } from '../DiaryEditor/MilkdownEditor';
import '../DiaryEditor/DiaryEditor.css';

export interface SummaryInstructionsConfig {
  monthlySummarySource: 'weeklies' | 'diaries';
  templates: {
    weekly: string;
    monthly: string;
    quarterly: string;
    yearly: string;
  };
}

export interface SummarySettingsViewProps {
  config: SummaryInstructionsConfig;
  onChange: (config: SummaryInstructionsConfig) => void;
  onResetTemplate?: (type: 'weekly' | 'monthly' | 'quarterly' | 'yearly') => string;
}

export const SummarySettingsView: React.FC<SummarySettingsViewProps> = ({ config, onChange, onResetTemplate }) => {
  const { t } = useTranslation();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'weekly' | 'monthly' | 'quarterly' | 'yearly'>('weekly');
  
  // Local state for actively edited text before saving
  const [localText, setLocalText] = useState(config.templates[activeTab] || '');
  const [resetKey, setResetKey] = useState(0);

  // Handle tab switch
  const handleTabChange = (tab: 'weekly' | 'monthly' | 'quarterly' | 'yearly') => {
    setActiveTab(tab);
    setLocalText(config.templates[tab] || '');
  };

  const handleSave = () => {
    const nextTemplates = { ...config.templates, [activeTab]: localText };
    onChange({ ...config, templates: nextTemplates });
    toast.showSuccess(t('settings.saved', '已保存'));
  };

  const handleReset = () => {
    if (onResetTemplate) {
      const defaultText = onResetTemplate(activeTab);
      setLocalText(defaultText);
      setResetKey(prev => prev + 1);
      // Auto save on reset? Yes, to keep it simple.
      const nextTemplates = { ...config.templates, [activeTab]: defaultText };
      onChange({ ...config, templates: nextTemplates });
      toast.show('已恢复默认模板');
    }
  };

  const tabs = [
    { id: 'weekly' as const, icon: '📅', label: t('summary.tab_weekly', '周结') },
    { id: 'monthly' as const, icon: '🗓️', label: t('summary.tab_monthly', '月结') },
    { id: 'quarterly' as const, icon: '📊', label: t('summary.tab_quarterly', '季结') },
    { id: 'yearly' as const, icon: '📆', label: t('summary.tab_yearly', '年结') }
  ];

  return (
    <div className={styles.container}>
      {/* 数据源选择 */}
      <div className={styles.cardSection}>
        <div className={styles.cardTitleLine}>
          <span>📥 {t('settings.monthly_summary_data_source', '月结数据收拢源')}</span>
        </div>
        <p className={styles.cardDesc}>{t('settings.monthly_summary_data_source_desc', '选择在进行 AI 大周期总结时，如何提取底层事实材料。')}</p>
        
        <div className={styles.btnGroup}>
          <button 
            className={`${styles.segBtn} ${config.monthlySummarySource === 'weeklies' ? styles.active : ''}`}
            onClick={() => onChange({ ...config, monthlySummarySource: 'weeklies' })}
          >
            <span>📅</span> {t('settings.read_only_weeklies', '仅综合每周总结 (速度快)')}
          </button>
          <button 
            className={`${styles.segBtn} ${config.monthlySummarySource === 'diaries' ? styles.active : ''}`}
            onClick={() => onChange({ ...config, monthlySummarySource: 'diaries' })}
          >
            <span>📄</span> {t('settings.read_all_diaries', '直读所有日记条目 (精度高)')}
          </button>
        </div>
      </div>

      {/* AI 提示词模板 */}
      <div className={styles.cardSection}>
        <div className={styles.cardTitleLine}>
          <span>📝 {t('settings.summary_ai_prompt_title', 'AI 总结指令模板与格式规范 (Prompting)')}</span>
        </div>
        <p className={styles.cardDesc}>{t('settings.summary_ai_prompt_desc', '这些咒语模板将在白守运行自动化周期总结任务时，作为系统级指令(System Prompt)直接干预 AI 输出结果的形式。')}</p>

        <div className={styles.tabBar}>
          {tabs.map(tab => (
            <button 
              key={tab.id}
              className={`${styles.tabBtn} ${activeTab === tab.id ? styles.active : ''}`}
              onClick={() => handleTabChange(tab.id)}
            >
              <span>{tab.icon}</span> {tab.label}
            </button>
          ))}
        </div>

        <div className={styles.textAreaWrapper}>
          <div className={styles.milkdownContainer}>
            <MilkdownEditorWrapper 
              key={`${activeTab}-${resetKey}`}
              content={localText}
              onChange={(val) => setLocalText(val || '')}
              placeholder={t('settings.summary_ai_prompt_hint', '请输入用于引导生成的 Prompt...')}
            />
          </div>
          <div className={styles.actionsRow}>
            <button className={styles.resetBtn} onClick={handleReset}>
              {t('settings.restore_default', '恢复默认出厂设定')}
            </button>
            <button className={styles.saveBtn} onClick={handleSave}>
              {t('common.save', '保存当前模板')}
            </button>
          </div>
        </div>
      </div>

      {/* 提示信息 */}
      <div className={styles.infoBox}>
         <div className={styles.infoIcon}>💡</div>
         <p className={styles.infoDesc}>
           {t('settings.summary_instructions_desc', '您可以自由定制输出格式（例如要求 AI 以特殊的傲娇语气或是严格的商务周报格式进行汇报）。变量会被自动替换。如果不确信，可以随时恢复默认。')}
         </p>
      </div>

    </div>
  );
};
