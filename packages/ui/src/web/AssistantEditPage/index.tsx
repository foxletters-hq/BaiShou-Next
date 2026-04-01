import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Trash2, Cpu, Sparkles, Database, Thermometer, Box, Hash, MessageSquareText } from 'lucide-react';
import styles from './AssistantEditPage.module.css';

// 假设项目中已挂载此渲染器，如果在 UI 库中尚未暴露，可退化为普通渲染
import { MarkdownRenderer } from '../MarkdownRenderer';

// ─── 类型定义 ──────────────────────────────────────────────

export interface AssistantFormData {
  id?: string;
  name: string;
  emoji: string;
  description: string;
  systemPrompt: string;
  contextWindow: number;
  providerId?: string;
  modelId?: string;
  compressTokenThreshold: number;
  compressKeepTurns: number;
  
  // 按照 B2.3 任务书新增指令字段
  welcomeMessage?: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  ragSpaceId?: string;
}

export interface AssistantEditPageProps {
  assistant: AssistantFormData | null;
  isLastAssistant?: boolean;
  onSave: (data: AssistantFormData) => void;
  onDelete?: () => void;
  onBack: () => void;
  onPickEmoji?: () => Promise<string | null>;
  onPickRagSpace?: () => Promise<string | null>;
}

// ─── 变量预设 ─────────────────────────────────────────────
const PROMPT_VARIABLES = [
  { label: '{{user_name}}', desc: '用户昵称' },
  { label: '{{current_date}}', desc: '当前日期' },
  { label: '{{current_time}}', desc: '当前时间' },
  { label: '{{os_info}}', desc: '系统环境' }
];

// ─── 主组件 ──────────────────────────────────────────────────

export const AssistantEditPage: React.FC<AssistantEditPageProps> = ({
  assistant,
  isLastAssistant = false,
  onSave,
  onDelete,
  onBack,
  onPickEmoji,
  onPickRagSpace,
}) => {
  const { t } = useTranslation();
  const isEditing = assistant !== null;

  // ─── 表单状态 ────────────────────
  const [name, setName] = useState(assistant?.name ?? '');
  const [emoji, setEmoji] = useState(assistant?.emoji ?? '🍵');
  const [description, setDescription] = useState(assistant?.description ?? '');
  const [systemPrompt, setSystemPrompt] = useState(assistant?.systemPrompt ?? '');
  const [welcomeMessage, setWelcomeMessage] = useState(assistant?.welcomeMessage ?? '');
  const [ragSpaceId, setRagSpaceId] = useState(assistant?.ragSpaceId ?? '');
  
  const [contextWindow, setContextWindow] = useState(assistant?.contextWindow ?? -1);
  const [providerId, setProviderId] = useState(assistant?.providerId);
  const [modelId, setModelId] = useState(assistant?.modelId);
  
  const [compressThreshold, setCompressThreshold] = useState(assistant?.compressTokenThreshold ?? 60000);
  const [compressKeepTurns, setCompressKeepTurns] = useState(assistant?.compressKeepTurns ?? 3);

  const [temperature, setTemperature] = useState(assistant?.temperature ?? 0.7);
  const [topP, setTopP] = useState(assistant?.topP ?? 1.0);
  const [maxTokens, setMaxTokens] = useState(assistant?.maxTokens ?? 2000);

  const [saving, setSaving] = useState(false);
  const [promptMode, setPromptMode] = useState<'edit' | 'preview'>('edit');

  const isUnlimitedContext = contextWindow < 0;
  const isCompressDisabled = compressThreshold <= 0;
  const isUnlimitedMaxTokens = maxTokens <= 0;

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      onSave({
        id: assistant?.id,
        name: name.trim(),
        emoji,
        description: description.trim(),
        systemPrompt: systemPrompt.trim(),
        welcomeMessage: welcomeMessage.trim(),
        ragSpaceId: ragSpaceId || undefined,
        contextWindow: isUnlimitedContext ? -1 : contextWindow,
        providerId: providerId ?? undefined,
        modelId: modelId ?? undefined,
        compressTokenThreshold: isCompressDisabled ? 0 : compressThreshold,
        compressKeepTurns,
        temperature,
        topP,
        maxTokens: isUnlimitedMaxTokens ? -1 : maxTokens,
      });
    } finally {
        // Saving state managed externally if navigating away, but we clear spinner here just in case.
        setTimeout(() => setSaving(false), 800);
    }
  };

  const handlePickEmoji = async () => {
    if (onPickEmoji) {
      const picked = await onPickEmoji();
      if (picked) setEmoji(picked);
    }
  };

  const insertVariable = (variable: string) => {
    setSystemPrompt(prev => prev + variable);
  };

  const formatTokens = (tokens: number) => {
    if (tokens >= 10000) {
      const w = tokens / 10000;
      return `${w % 1 === 0 ? w.toFixed(0) : w.toFixed(1)}万`;
    }
    return String(tokens);
  };

  return (
    <div className={styles.page}>
      {/* App Bar */}
      <div className={styles.appBar}>
        <div className={styles.appBarLeft}>
          <button className={styles.backBtn} onClick={onBack}>
            <ChevronLeft size={18} />
          </button>
          <span className={styles.appBarTitle}>
            {isEditing
              ? t('agent.assistant.edit_title', '特调伙伴档案')
              : t('agent.assistant.create_title', '新建数字心智')}
          </span>
        </div>
        {isEditing && !isLastAssistant && onDelete && (
          <div className={styles.appBarActions}>
            <button className={styles.deleteBtn} onClick={onDelete}>
              <Trash2 size={14} /> {t('common.delete', '清除数据流')}
            </button>
          </div>
        )}
      </div>

      {/* Form Area */}
      <div className={styles.formBody}>
        <div className={styles.formContainer}>
          
          {/* Section: 身份名片 */}
          <div className={styles.formSection}>
             <div className={styles.sectionHeader}>
                <Sparkles size={18} className={styles.sectionIcon} />
                <span>核心身份标识</span>
             </div>
             
             <div className={styles.avatarSection}>
                <div className={styles.avatarCircle} onClick={handlePickEmoji}>
                  {emoji}
                  <span className={styles.avatarBadge}>✦</span>
                </div>
                <span className={styles.avatarHint}>
                  {t('agent.assistant.avatar_hint', '指派外显情绪粒子')}
                </span>
             </div>

             <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>{t('agent.assistant.name_label', '系统代号 (Name)')}</label>
                <input
                  className={styles.fieldInput}
                  placeholder={t('agent.assistant.name_hint', '例如：机要助理、代码专家')}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
             </div>

             <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>{t('agent.assistant.description_label', '职能描述 (Description)')}</label>
                <input
                  className={styles.fieldInput}
                  placeholder={t('agent.assistant.description_hint', '一句话描述该心智的特长与使命')}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
             </div>
          </div>

          {/* Section: 行为逻辑与提示词 */}
          <div className={styles.formSection}>
             <div className={styles.sectionHeader}>
                <Cpu size={18} className={styles.sectionIcon} />
                <span>底层行为链路 (System Prompt)</span>
             </div>
             <p className={styles.fieldHint}>定义该心智的思想边界、语言风格和回答惯性。</p>
             
             <div className={styles.fieldGroup}>
                <div className={styles.promptToolbar}>
                   <div className={styles.variablePills}>
                      {PROMPT_VARIABLES.map(v => (
                         <span key={v.label} className={styles.varPill} onClick={() => insertVariable(v.label)} title={v.desc}>
                            {v.label}
                         </span>
                      ))}
                   </div>
                   <div className={styles.promptTabs}>
                      <button 
                         className={`${styles.tabBtn} ${promptMode === 'edit' ? styles.tabBtnActive : ''}`}
                         onClick={() => setPromptMode('edit')}
                      >
                         编辑代码
                      </button>
                      <button 
                         className={`${styles.tabBtn} ${promptMode === 'preview' ? styles.tabBtnActive : ''}`}
                         onClick={() => setPromptMode('preview')}
                      >
                         全息预览
                      </button>
                   </div>
                </div>

                {promptMode === 'edit' ? (
                   <textarea
                     className={`${styles.fieldTextarea} ${styles.systemPromptArea}`}
                     placeholder={t('agent.assistant.prompt_hint', '我是白守，你的人工智能助手...')}
                     value={systemPrompt}
                     onChange={(e) => setSystemPrompt(e.target.value)}
                   />
                ) : (
                   <div className={styles.fieldTextarea} style={{ minHeight: 160, overflowY: 'auto' }}>
                      {systemPrompt.trim() ? <MarkdownRenderer content={systemPrompt} /> : <span style={{color: 'var(--text-secondary)'}}>无系统指令流录入...</span>}
                   </div>
                )}
             </div>

             <div className={styles.fieldGroup} style={{ marginTop: 12 }}>
                <label className={styles.fieldLabel} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <MessageSquareText size={16}/> 握手欢迎语 (Welcome Message)
                </label>
                <input
                  className={styles.fieldInput}
                  placeholder="用户开启新会话时自动发送的第一句话..."
                  value={welcomeMessage}
                  onChange={(e) => setWelcomeMessage(e.target.value)}
                />
             </div>
          </div>

          {/* Section: 外部神经连接 */}
          <div className={styles.formSection}>
             <div className={styles.sectionHeader}>
                <Database size={18} className={styles.sectionIcon} />
                <span>神经突触绑定</span>
             </div>

             <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>主干计算流 (Model)</label>
                {providerId && modelId ? (
                   <div className={styles.selectorCard} onClick={() => {/* TODO: Pop out Provider picker */}}>
                      <div className={styles.selectorIcon}><Box size={20}/></div>
                      <div className={styles.selectorContent}>
                         <div className={styles.selectorTitle}>{modelId}</div>
                         <div className={styles.selectorSubtitle}>{providerId} 引擎提供算力支持</div>
                      </div>
                      <span className={styles.selectorAction} onClick={(e) => { e.stopPropagation(); setProviderId(undefined); setModelId(undefined);}}>
                         解除
                      </span>
                   </div>
                ) : (
                   <div className={styles.selectorCard} onClick={() => {/* Pick model */}}>
                      <div className={styles.selectorIcon}><Box size={20}/></div>
                      <div className={styles.selectorContent}>
                         <div className={styles.selectorTitle}>全局默认协同列阵</div>
                         <div className={styles.selectorSubtitle}>继承系统配置中的主模型设置</div>
                      </div>
                      <span className={styles.selectorAction}>更改</span>
                   </div>
                )}
             </div>

             <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>外挂记忆库 (RAG Knowledge)</label>
                <div className={styles.selectorCard} onClick={async () => {
                   if(onPickRagSpace) {
                      const space = await onPickRagSpace();
                      if(space) setRagSpaceId(space);
                   }
                }}>
                   <div className={styles.selectorIcon}><Database size={20}/></div>
                   <div className={styles.selectorContent}>
                      <div className={styles.selectorTitle}>{ragSpaceId ? `已挂接扇区：${ragSpaceId}` : '未挂接任何记忆矩阵'}</div>
                      <div className={styles.selectorSubtitle}>{ragSpaceId ? '注入特化领域的极速高维向量查询' : '目前仅使用上下文裸存'}</div>
                   </div>
                   <span className={styles.selectorAction}>{ragSpaceId ? '变更' : '检索'}</span>
                </div>
             </div>
          </div>

          {/* Section: 高级神经参数与压缩 */}
          <div className={styles.formSection}>
             <div className={styles.sectionHeader}>
                <Thermometer size={18} className={styles.sectionIcon} />
                <span>高级神经节控制 (Advanced)</span>
             </div>
             
             {/* Temperature */}
             <div className={styles.sliderWrapper}>
                <div className={styles.sliderHeaderLine}>
                   <div className={styles.sliderLabelWrap}>
                      <span className={styles.sliderLabel}>发散温度 (Temperature)</span>
                      <span className={styles.sliderSub}>降低数值更理性严谨，升高则更具跳跃创造力</span>
                   </div>
                   <span className={styles.sliderValueBox}>{temperature.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  className={styles.sliderInput}
                  min={0.0} max={2.0} step={0.1}
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                />
             </div>

             {/* Top-P */}
             <div className={styles.sliderWrapper} style={{ marginTop: 12 }}>
                <div className={styles.sliderHeaderLine}>
                   <div className={styles.sliderLabelWrap}>
                      <span className={styles.sliderLabel}>采样熵界限 (Top P)</span>
                      <span className={styles.sliderSub}>控制概率词汇分布范围，通常不建议与 Temperature 同时大幅调整</span>
                   </div>
                   <span className={styles.sliderValueBox}>{topP.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  className={styles.sliderInput}
                  min={0.1} max={1.0} step={0.05}
                  value={topP}
                  onChange={(e) => setTopP(parseFloat(e.target.value))}
                />
             </div>

             {/* Context Window */}
             <div className={styles.sliderWrapper} style={{ marginTop: 12 }}>
                <div className={styles.sliderHeaderLine}>
                   <div className={styles.sliderLabelWrap}>
                      <span className={styles.sliderLabel}>短期记忆轮跨度 (Context Limit)</span>
                      <span className={styles.sliderSub}>
                         {isUnlimitedContext ? '无限吸收当前全部会话数据（小心过载）。' : '设定当前向大模型投喂的最大追溯轮数。'}
                      </span>
                   </div>
                   <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                     {!isUnlimitedContext && <span className={styles.sliderValueBox}>{contextWindow} 轮</span>}
                     <label className={styles.toggleSwitch}>
                       <input type="checkbox" checked={!isUnlimitedContext} onChange={(e) => setContextWindow(e.target.checked ? 10 : -1)} />
                       <span className={styles.toggleSlider}></span>
                     </label>
                   </div>
                </div>
                {!isUnlimitedContext && (
                   <input
                     type="range"
                     className={styles.sliderInput}
                     min={2} max={100} step={1}
                     value={contextWindow}
                     onChange={(e) => setContextWindow(Number(e.target.value))}
                   />
                )}
             </div>

             {/* Compression & Token Threshold */}
             <div className={styles.sliderWrapper} style={{ marginTop: 12 }}>
                <div className={styles.sliderHeaderLine}>
                   <div className={styles.sliderLabelWrap}>
                      <span className={styles.sliderLabel}>长栈无损蒸馏压缩 (Auto-Compression)</span>
                      <span className={styles.sliderSub}>开启后到达设定阈值时执行摘要打包。保留轮数：{compressKeepTurns}。</span>
                   </div>
                   <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                     {!isCompressDisabled && <span className={styles.sliderValueBox}>{formatTokens(compressThreshold)} TK</span>}
                     <label className={styles.toggleSwitch}>
                       <input type="checkbox" checked={!isCompressDisabled} onChange={(e) => setCompressThreshold(e.target.checked ? 60000 : 0)} />
                       <span className={styles.toggleSlider}></span>
                     </label>
                   </div>
                </div>
                {!isCompressDisabled && (
                   <>
                     <input
                       type="range"
                       className={styles.sliderInput}
                       min={10000} max={1000000} step={10000}
                       value={compressThreshold}
                       onChange={(e) => setCompressThreshold(Number(e.target.value))}
                     />
                     <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                        <Hash size={14} color="var(--text-secondary)"/>
                        <span style={{ fontSize: 13, color: 'var(--text-secondary)'}}>保留末尾未压缩裸轮数：</span>
                        <input
                          type="range"
                          className={styles.sliderInput}
                          style={{ flex: 1 }}
                          min={1} max={10} step={1}
                          value={compressKeepTurns}
                          onChange={(e) => setCompressKeepTurns(Number(e.target.value))}
                        />
                        <span style={{ fontSize: 13, minWidth: 20 }}>{compressKeepTurns}</span>
                     </div>
                   </>
                )}
             </div>

             {/* Max Tokens */}
             <div className={styles.sliderWrapper} style={{ marginTop: 12 }}>
                <div className={styles.sliderHeaderLine}>
                   <div className={styles.sliderLabelWrap}>
                      <span className={styles.sliderLabel}>单次爆发峰值 (Max Tokens)</span>
                      <span className={styles.sliderSub}>限制助手单次回复的最大词汇量。关闭限制代表允许大模型尽情输出直至受限。</span>
                   </div>
                   <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                     {!isUnlimitedMaxTokens && <span className={styles.sliderValueBox}>{formatTokens(maxTokens)} TK</span>}
                     <label className={styles.toggleSwitch}>
                       <input type="checkbox" checked={!isUnlimitedMaxTokens} onChange={(e) => setMaxTokens(e.target.checked ? 2000 : -1)} />
                       <span className={styles.toggleSlider}></span>
                     </label>
                   </div>
                </div>
                {!isUnlimitedMaxTokens && (
                   <input
                     type="range"
                     className={styles.sliderInput}
                     min={100} max={100000} step={100}
                     value={maxTokens}
                     onChange={(e) => setMaxTokens(Number(e.target.value))}
                   />
                )}
             </div>

          </div>

          <div className={styles.saveBtnContainer}>
             <button className={styles.saveBtn} onClick={handleSave} disabled={saving || !name.trim()}>
                <Sparkles size={16} /> 
                {saving ? '脑波刻录中...' : t('common.save', '锁定潜意识写入')}
             </button>
          </div>
          
        </div>
      </div>
    </div>
  );
};
