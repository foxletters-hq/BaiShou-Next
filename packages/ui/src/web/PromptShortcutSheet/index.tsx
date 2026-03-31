import React, { useState } from 'react';
import styles from './PromptShortcutSheet.module.css';

export interface PromptShortcut {
  id: string;
  trigger?: string;
  command?: string;
  icon?: string;
  name?: string;
  content: string;
  description?: string;
}

interface PromptShortcutSheetProps {
  shortcuts: PromptShortcut[];
  onSelect: (content: string) => void;
  onAdd: (shortcut: Omit<PromptShortcut, 'id'>) => void;
  onUpdate: (id: string, shortcut: Omit<PromptShortcut, 'id'>) => void;
  onDelete: (id: string) => void;
  onReorder: (oldIndex: number, newIndex: number) => void;
  onClose: () => void;
}

export const PromptShortcutSheet: React.FC<PromptShortcutSheetProps> = ({
  shortcuts,
  onSelect,
  onAdd,
  onUpdate,
  onDelete,
  onReorder,
  onClose
}) => {
  const [editingItem, setEditingItem] = useState<PromptShortcut | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  // Drag and drop state
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

  const handleDragStart = (idx: number) => setDraggedIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === idx) return;
    onReorder(draggedIdx, idx);
    setDraggedIdx(idx); // Update pointer to new spot fluidly
  };
  const handleDragEnd = () => setDraggedIdx(null);

  if (isAdding || editingItem) {
    return (
      <ShortcutEditor
        shortcut={editingItem}
        onSave={(item) => {
          if (editingItem) onUpdate(editingItem.id, item);
          else onAdd(item);
          setEditingItem(null);
          setIsAdding(false);
        }}
        onCancel={() => {
          setEditingItem(null);
          setIsAdding(false);
        }}
      />
    );
  }

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <div className={styles.sheet}>
        <div className={styles.header}>
          <div className={styles.titleWrap}>
            <span className={styles.boltIcon}>⚡</span>
            <h2>快捷指令</h2>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.iconBtn} onClick={() => setIsAdding(true)} title="新建">➕</button>
            <button className={styles.closeBtn} onClick={onClose}>✕</button>
          </div>
        </div>

        <div className={styles.list}>
          {shortcuts.length === 0 ? (
            <div className={styles.empty}>暂无快捷指令</div>
          ) : (
            shortcuts.map((sc, index) => (
              <div 
                key={sc.id} 
                className={`${styles.shortcutItem} ${draggedIdx === index ? styles.dragging : ''}`}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
              >
                <div className={styles.dragHandle}>☰</div>
                <div 
                   className={styles.clickArea} 
                   onClick={() => onSelect(sc.content || sc.command || '')}
                >
                  <div className={styles.iconBox}>
                    {sc.icon || sc.trigger?.charAt(0).toUpperCase() || '⚡'}
                  </div>
                  <div className={styles.commandContent}>
                    <span className={styles.description}>{sc.name || sc.description}</span>
                    <span className={styles.commandPreview}>{sc.content || sc.command}</span>
                  </div>
                </div>
                
                <div className={styles.itemActions}>
                  <button onClick={(e) => { e.stopPropagation(); setEditingItem(sc); }}>✎</button>
                  <button onClick={(e) => { e.stopPropagation(); onDelete(sc.id); }} className={styles.delBtn}>✖</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
};

const ShortcutEditor: React.FC<{
  shortcut: PromptShortcut | null;
  onSave: (item: Omit<PromptShortcut, 'id'>) => void;
  onCancel: () => void;
}> = ({ shortcut, onSave, onCancel }) => {
  const [icon, setIcon] = useState(shortcut?.icon || '⚡');
  const [name, setName] = useState(shortcut?.name || shortcut?.description || '');
  const [content, setContent] = useState(shortcut?.content || shortcut?.command || '');

  return (
    <div className={styles.sheet}>
      <div className={styles.header}>
        <h2>{shortcut ? '编辑指令' : '新建指令'}</h2>
        <button className={styles.closeBtn} onClick={onCancel}>✕</button>
      </div>
      <div className={styles.editorBody}>
        <div className={styles.inputRow}>
           <input className={styles.iconInput} value={icon} onChange={e => setIcon(e.target.value)} maxLength={2} placeholder="图标" />
           <input className={styles.textInput} value={name} onChange={e => setName(e.target.value)} placeholder="指令名称 (例: 总结提取)" />
        </div>
        <textarea 
          className={styles.textArea} 
          value={content} 
          onChange={e => setContent(e.target.value)} 
          placeholder="输入将要发送给AI的Prompt模板..."
        />
      </div>
      <div className={styles.editorFooter}>
         <button className={styles.cancelBtn} onClick={onCancel}>取消</button>
         <button 
           className={styles.saveBtn} 
           onClick={() => { if(name && content) onSave({ icon, name, content, description: name, command: content }); }}
           disabled={!name || !content}
         >保存</button>
      </div>
    </div>
  );
};
