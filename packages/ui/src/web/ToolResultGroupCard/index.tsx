import React, { useState } from 'react';
import styles from './ToolResultGroupCard.module.css';

export interface ToolInvocation {
  id: string;
  toolName: string;
  argsString: string;
  resultString?: string;
  isError?: boolean;
}

interface ToolResultGroupCardProps {
  invocations: ToolInvocation[];
}

export const ToolResultGroupCard: React.FC<ToolResultGroupCardProps> = ({ invocations }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  if (invocations.length === 0) return null;

  return (
     <div className={styles.groupCard}>
        <div className={styles.groupHeader}>
           <span className={styles.headerIcon}>🧩</span>
           <span className={styles.headerTitle}>调用了 {invocations.length} 个本地工具</span>
        </div>
        
        <div className={styles.invocationsList}>
           {invocations.map(inv => {
              const isExpanded = expandedId === inv.id;
              return (
                 <div key={inv.id} className={`${styles.toolItem} ${inv.isError ? styles.hasError : ''}`}>
                    <div 
                      className={styles.toolItemHeader} 
                      onClick={() => toggleExpand(inv.id)}
                    >
                       <span className={styles.toggleArrow}>
                         {isExpanded ? '▼' : '▶'}
                       </span>
                       <span className={styles.toolName}>{inv.toolName}</span>
                       <span className={styles.statusBadge}>
                         {inv.resultString ? (inv.isError ? '执行失败' : '执行完成') : '执行中...'}
                       </span>
                    </div>
                    
                    {isExpanded && (
                       <div className={styles.toolItemBody}>
                          <div className={styles.codeBlock}>
                             <div className={styles.codeLabel}>Arguments</div>
                             <pre>{inv.argsString}</pre>
                          </div>
                          {inv.resultString && (
                             <div className={`${styles.codeBlock} ${styles.resultBlock}`}>
                                <div className={styles.codeLabel}>Result</div>
                                <pre>{inv.resultString}</pre>
                             </div>
                          )}
                       </div>
                    )}
                 </div>
              );
           })}
        </div>
     </div>
  );
};
