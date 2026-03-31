import React from 'react';
import styles from './ChatCostDialog.module.css';

interface CostDetails {
  modelName: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: string; // e.g. "$0.0032" or "0.032¥"
}

interface ChatCostDialogProps {
  details: CostDetails;
  onClose: () => void;
}

export const ChatCostDialog: React.FC<ChatCostDialogProps> = ({ details, onClose }) => {
  return (
    <>
       <div className={styles.overlay} onClick={onClose} />
       <div className={styles.dialog}>
          <div className={styles.header}>
             <h3>会话账单对账</h3>
             <button className={styles.closeBtn} onClick={onClose}>✕</button>
          </div>
          <div className={styles.receiptBody}>
             <div className={styles.modelTag}>
                <span className={styles.modelIcon}>🧠</span>
                <span>{details.modelName}</span>
             </div>
             
             <div className={styles.itemRow}>
                <span className={styles.itemLabel}>输入 (Prompt)</span>
                <span className={styles.itemValue}>{details.promptTokens.toLocaleString()} tk</span>
             </div>
             <div className={styles.itemRow}>
                <span className={styles.itemLabel}>输出 (Completion)</span>
                <span className={styles.itemValue}>{details.completionTokens.toLocaleString()} tk</span>
             </div>
             <div className={styles.divider} />
             <div className={styles.totalRow}>
                <span className={styles.totalLabel}>合计流转</span>
                <span className={styles.totalValue}>{details.totalTokens.toLocaleString()} tk</span>
             </div>
             <div className={styles.costBox}>
                <span className={styles.costTitle}>预计开销 / USD Cost</span>
                <span className={styles.costPrice}>{details.estimatedCost}</span>
             </div>
          </div>
          <div className={styles.footer}>
             <button className={styles.confirmBtn} onClick={onClose}>收到</button>
          </div>
       </div>
    </>
  );
};
