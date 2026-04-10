import React, { useEffect } from 'react';
import styles from './ChatCostDialog.module.css';
import { useTranslation } from 'react-i18next';

export interface CostDetails {
  modelName?: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens?: number;
  estimatedCost: string; 
  lastInputTokens?: number;
}

export interface ChatCostDialogProps {
  details: CostDetails;
  onClose: () => void;
  isOpen: boolean;
}

export const ChatCostDialog: React.FC<ChatCostDialogProps> = ({ details, onClose, isOpen }) => {
  const { t } = useTranslation();

  // Close on Escape 
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
       <div className={styles.overlay} onClick={onClose} />
       <div className={styles.dialog} onClick={e => e.stopPropagation()}>
          <h2 className={styles.title}>{t('agent.chat.cost_detail_title', '当前计费')}</h2>
          
          <div className={styles.content}>
             <h3 className={styles.sectionTitle}>{t('agent.chat.cost_cumulative_title', '累计 API 消耗')}</h3>
             <div className={styles.spacer8} />
             <div className={styles.costRow}>
                <span className={styles.costLabel}>{t('agent.chat.cost_cumulative_total', '累计费用')}</span>
                <span className={styles.costValue}>{details.estimatedCost}</span>
             </div>
             <div className={styles.costRow}>
                <span className={styles.costLabel}>{t('agent.chat.cost_cumulative_input', '累计 Input')}</span>
                <span className={styles.costValue}>{details.promptTokens} {t('agent.chat.tokens_unit', 'tokens')}</span>
             </div>
             <div className={styles.costRow}>
                <span className={styles.costLabel}>{t('agent.chat.cost_cumulative_output', '累计 Output')}</span>
                <span className={styles.costValue}>{details.completionTokens} {t('agent.chat.tokens_unit', 'tokens')}</span>
             </div>
             
             <div className={styles.divider} />
             
             <h3 className={styles.sectionTitle}>{t('agent.chat.cost_context_title', '当前上下文')}</h3>
             <div className={styles.spacer8} />
             <div className={styles.costRow}>
                <span className={styles.costLabel}>{t('agent.chat.cost_context_size', '上下文大小')}</span>
                <span className={styles.costValue}>
                  {(details.lastInputTokens || details.promptTokens) > 0 
                    ? `${details.lastInputTokens || details.promptTokens} ${t('agent.chat.tokens_unit', 'tokens')}` 
                    : t('agent.chat.cost_no_data', '暂无数据')}
                </span>
             </div>
             
             <div className={styles.spacer16} />
             
             <p className={styles.disclaimer}>
               {t('agent.chat.cost_disclaimer', '提示：此费用计算数据来自本地 pricing 规则 (或 models.dev)，存在更新不及时或计费方式不同的情况，仅供参考。')}
             </p>
          </div>

          <div className={styles.actions}>
             <button className={styles.textButton} onClick={onClose}>
               {t('common.confirm', '确认')}
             </button>
          </div>
       </div>
    </>
  );
};
