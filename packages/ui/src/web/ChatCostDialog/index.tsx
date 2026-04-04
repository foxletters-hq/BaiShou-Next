import React, { useEffect } from 'react';
import styles from './ChatCostDialog.module.css';
import { Receipt, BrainCircuit, X, CornerDownRight, CornerUpRight, Sigma } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export interface CostDetails {
  modelName: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: string; // e.g. "$0.0032"
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
          <div className={styles.header}>
             <div className={styles.headerTitle}>
               <Receipt size={22} color="var(--color-primary, #5BA8F5)" strokeWidth={2.5}/> 
               {t('agent.chat.billingReceipt', '会话账单核算')}
             </div>
             <button className={styles.closeBtn} onClick={onClose} title={t('common.close', '关闭')}>
                <X size={20} strokeWidth={2.5}/>
             </button>
          </div>

          <div className={styles.receiptBody}>
             <div className={styles.modelTag}>
                <BrainCircuit size={16} />
                <span>{details.modelName}</span>
             </div>
             
             <div className={styles.itemRow}>
                <span className={styles.itemLabel}>
                   <CornerDownRight size={14} /> {t('agent.chat.promptTokens', '输入 (Prompt)')}
                </span>
                <span className={styles.itemValue}>{details.promptTokens.toLocaleString()}</span>
             </div>
             
             <div className={styles.itemRow}>
                <span className={styles.itemLabel}>
                   <CornerUpRight size={14} /> {t('agent.chat.completionTokens', '输出 (Completion)')}
                </span>
                <span className={styles.itemValue}>{details.completionTokens.toLocaleString()}</span>
             </div>
             
             <div className={styles.divider} />
             
             <div className={styles.totalRow}>
                <span className={styles.totalLabel}>
                   <Sigma size={18} strokeWidth={2.5} color="var(--text-secondary, #64748B)"/> 
                   {t('agent.chat.totalTokens', '合计流转流')}
                </span>
                <span className={styles.totalValue}>{details.totalTokens.toLocaleString()}</span>
             </div>
             
             <div className={styles.costBox}>
                <span className={styles.costTitle}>{t('agent.chat.estimatedCost', 'ESTIMATED USD COST / 开销')}</span>
                <span className={styles.costPrice}>{details.estimatedCost}</span>
             </div>
          </div>

          <div className={styles.footer}>
             <button className={styles.confirmBtn} onClick={onClose}>
               {t('common.gotIt', '确 认')}
             </button>
          </div>
       </div>
    </>
  );
};
