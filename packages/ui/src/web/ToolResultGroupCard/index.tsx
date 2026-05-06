import React, { useState } from 'react';
import styles from './ToolResultGroupCard.module.css';
import { MockToolInvocation } from '@baishou/shared/src/mock/agent.mock';
import { useTranslation } from 'react-i18next';
import { ChevronDown, CheckCircle2, XCircle } from 'lucide-react';

export interface ToolResultGroupProps {
  invocations: MockToolInvocation[];
}

export const ToolResultGroup: React.FC<ToolResultGroupProps> = ({ invocations }) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  if (!invocations || invocations.length === 0) return null;

  return (
    <div className={styles.groupContainer}>
       <div className={`${styles.groupCard} ${expanded ? styles.open : ''}`}>
           <div 
             className={styles.headerRow} 
             onClick={() => setExpanded(!expanded)}
           >
              <div className={styles.iconBox}>🎧</div>
              <div className={styles.titleArea}>
                 <span className={styles.titleText}>
                    {t('agent.tools.tool_call_results', { count: invocations.length })}
                 </span>
                 <span className={styles.countBadge}>{invocations.length}</span>
              </div>
             
             <div className={`${styles.expandBtn} ${expanded ? styles.expandBtnRotated : ''}`}>
                <ChevronDown size={14} />
             </div>
          </div>
          
          <div className={styles.contentWrap}>
            <div className={styles.contentInner}>
              <div className={styles.childrenArea}>
                 {invocations.map((inv, index) => <ToolResultItem key={inv.toolCallId || index} invocation={inv} />)}
              </div>
            </div>
          </div>
       </div>
    </div>
  );
};

const ToolResultItem: React.FC<{ invocation: MockToolInvocation }> = ({ invocation }) => {
  const [expanded, setExpanded] = useState(false);
  
  const getToolName = () => {
    if (invocation.toolName) return invocation.toolName;
    const callId = invocation.toolCallId;
    if (!callId) return 'tool_invocation';
    return callId;
  };
  
  const resultObj = typeof invocation.result === 'string' ? { content: invocation.result } : (invocation.result || { content: '' });
  const rawContent = typeof invocation.result === 'string' ? invocation.result : JSON.stringify(resultObj);
  const isError = rawContent.startsWith('Error') || rawContent.startsWith('Tool execution failed:') || rawContent.toLowerCase().includes('failed');
  
  const toolName = getToolName();

  // Try to parse JSON for structured rendering
  let parsedJson: any = null;
  if (typeof invocation.result === 'object' && invocation.result !== null) {
      parsedJson = invocation.result;
  } else {
      try {
        parsedJson = JSON.parse(rawContent);
      } catch (e) {
        // Expected for plain text callbacks
      }
  }

  const renderStructuredData = (data: any) => {
    if (Array.isArray(data)) {
      return (
         <div className={styles.structDataGrid}>
           {data.map((item, i) => (
              <div key={i} className={styles.structItem}>
                 {item.title && <div className={styles.structTitle}>{item.title}</div>}
                 {item.url && <a href={item.url} target="_blank" rel="noreferrer" className={styles.structLink}>{item.url}</a>}
                 {item.snippet && <div className={styles.structSnippet}>{item.snippet}</div>}
                 {item.summary && <div className={styles.structSnippet}>{item.summary}</div>}
                 
                 {/* For generic flat objects */}
                 {(!item.title && !item.snippet && typeof item === 'object') && Object.keys(item).map(k => (
                    <div className={styles.structValueRow} key={k}>
                       <span className={styles.structKey}>{k}</span>
                       <span className={styles.structVal}>{String(item[k])}</span>
                    </div>
                 ))}
              </div>
           ))}
         </div>
      );
    } else if (typeof data === 'object' && data !== null) {
      return (
         <div className={styles.structDataGrid}>
           {data.title && <div className={styles.structTitle}>{data.title}</div>}
           {data.snippet && <div className={styles.structSnippet}>{data.snippet}</div>}
           <div className={styles.structItem}>
              {Object.keys(data).filter(k => k !== 'title' && k !== 'snippet').map(k => (
                 <div className={styles.structValueRow} key={k}>
                    <span className={styles.structKey}>{k}</span>
                    <span className={styles.structVal}>{String(data[k])}</span>
                 </div>
              ))}
           </div>
         </div>
      );
    }
    // Fallback if structured but unknown shape
    return <pre className={styles.resultTextLog}>{JSON.stringify(data, null, 2)}</pre>;
  };

  return (
    <div className={`${styles.itemCard} ${isError ? styles.itemError : ''} ${expanded ? styles.itemOpen : ''}`}>
       <div 
         className={styles.itemHeader} 
         onClick={() => setExpanded(!expanded)}
       >
          <span className={styles.itemStatusWrap}>
             {isError ? <XCircle size={14} color="rgba(244, 67, 54, 1)" /> : <CheckCircle2 size={14} />}
          </span>
          <span className={styles.itemName}>{toolName}</span>
       </div>
       
       <div className={styles.itemContentWrap}>
          <div className={styles.itemContentInner}>
            <div className={styles.contentWrapper}>
               {parsedJson && !isError ? (
                 renderStructuredData(parsedJson)
               ) : (
                 <pre className={`${styles.resultTextLog} ${isError ? styles.errorText : ''}`}>{rawContent}</pre>
               )}
            </div>
          </div>
       </div>
    </div>
  );
};
