import React, { useState } from 'react';
import styles from './ToolResultGroupCard.module.css';
import { MockChatMessage } from '@baishou/shared/src/mock/agent.mock';

// TODO: [Agent1-Dependency] 替换 i18n
const useTranslation = (): { t: (key: string, options?: any) => string } => ({
  t: (key: string, options?: any) => `调用了 ${options?.count || 0} 个操作`,
});

interface ToolResultGroupProps {
  messages: MockChatMessage[];
}

export const ToolResultGroup: React.FC<ToolResultGroupProps> = ({ messages }) => {
  const [expanded, setExpanded] = useState(false);
  const { t } = useTranslation();

  if (!messages || messages.length === 0) return null;

  return (
    <div className={styles.groupContainer}>
       <div className={styles.indentLeft}></div>
       <div className={styles.groupCard}>
          <div 
            className={styles.headerRow} 
            onClick={() => setExpanded(!expanded)}
          >
             <div className={styles.iconBox}>
                🔧
             </div>
             
             <div className={styles.titleArea}>
                <span className={styles.titleText}>
                   {t('agent.tools.tool_call_results', { count: messages.length })}
                </span>
                <span className={styles.countBadge}>{messages.length}</span>
             </div>
             
             <div className={styles.expandIcon}>
                {expanded ? '▲' : '▼'}
             </div>
          </div>
          
          {expanded && (
             <div className={styles.childrenArea}>
                {messages.map(msg => <ToolResultItem key={msg.id} message={msg} />)}
             </div>
          )}
       </div>
    </div>
  );
};

const ToolResultItem: React.FC<{ message: MockChatMessage }> = ({ message }) => {
  const [expanded, setExpanded] = useState(false);
  
  const getToolName = () => {
    if (message.toolName) return message.toolName;
    const callId = message.toolCallId;
    if (!callId) return 'tool';
    const parts = callId.split('_');
    if (parts.length >= 3 && parts[0] === 'gemini') {
      return parts.slice(1, parts.length - 1).join('_');
    }
    return 'tool';
  };
  
  const isError = () => {
    const content = message.content || '';
    return content.startsWith('Tool execution failed:') || 
           content.startsWith('Tool "') || 
           content.startsWith('Error');
  };
  
  const hasError = isError();
  const toolName = getToolName();
  const content = message.content || '';

  return (
    <div className={`${styles.itemCard} ${hasError ? styles.itemError : ''}`}>
       <div 
         className={styles.itemHeader} 
         onClick={() => setExpanded(!expanded)}
       >
          <span className={styles.statusIcon}>
             {hasError ? '❌' : '✅'}
          </span>
          <span className={styles.itemName}>{toolName}</span>
       </div>
       
       {expanded && (
          <div className={styles.itemBody}>
             <pre className={styles.resultText}>{content}</pre>
          </div>
       )}
    </div>
  );
};
