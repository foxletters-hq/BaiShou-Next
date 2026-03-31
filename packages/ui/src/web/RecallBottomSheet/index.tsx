import React, { useState, useEffect } from 'react';
import styles from './RecallBottomSheet.module.css';

export interface ContextResultPreview {
  text: string;
  diaryCount: number;
  weekCount: number;
  monthCount: number;
  quarterCount: number;
  yearCount: number;
}

interface RecallBottomSheetProps {
  isLoading: boolean;
  preview: ContextResultPreview | null;
  onLoadPreview: (months: number) => void;
  onConfirm: (contextText: string, months: number) => void;
  onClose: () => void;
}

export const RecallBottomSheet: React.FC<RecallBottomSheetProps> = ({
  isLoading,
  preview,
  onLoadPreview,
  onConfirm,
  onClose
}) => {
  const [months, setMonths] = useState(6);
  // Debounce slider loading to prevent spamming context generation
  const [sliderIsMoving, setSliderIsMoving] = useState(false);

  useEffect(() => {
    if (!sliderIsMoving) {
      onLoadPreview(months);
    }
  }, [months, sliderIsMoving, onLoadPreview]);

  const handleConfirm = () => {
    if (preview?.text) {
      onConfirm(preview.text, months);
    }
  };

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <div className={styles.sheet}>
        <div className={styles.header}>
          <h2>📚 记忆库唤醒</h2>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.body}>
          <p className={styles.desc}>
            选择需要跨越的时间范围，以此构建出你这段时间来的生命图谱作为对话上下文。
          </p>
          
          <div className={styles.sliderHeader}>
            <span className={styles.sliderLabel}>时间范围</span>
            <div className={styles.sliderValueWrap}>
               <span className={styles.sliderValue}>{months}</span>
               <span className={styles.sliderUnit}>个月</span>
            </div>
          </div>
          
          <input 
            type="range" 
            min="1" max="60" 
            value={months} 
            onChange={(e) => setMonths(parseInt(e.target.value, 10))}
            onMouseDown={() => setSliderIsMoving(true)}
            onMouseUp={() => setSliderIsMoving(false)}
            onTouchStart={() => setSliderIsMoving(true)}
            onTouchEnd={() => setSliderIsMoving(false)}
            className={styles.slider}
          />

          <div className={styles.previewBox}>
            {isLoading ? (
              <div className={styles.loading}>加载生命图谱摘要...</div>
            ) : preview ? (
              <div className={styles.badges}>
                {preview.diaryCount > 0 && <StatBadge icon="📝" count={preview.diaryCount} label="日记" color="#10b981" />}
                {preview.weekCount > 0 && <StatBadge icon="🗓" count={preview.weekCount} label="周记" color="#6366f1" />}
                {preview.monthCount > 0 && <StatBadge icon="📊" count={preview.monthCount} label="月记" color="#3b82f6" />}
                {preview.quarterCount > 0 && <StatBadge icon="📅" count={preview.quarterCount} label="季报" color="#f59e0b" />}
                {preview.yearCount > 0 && <StatBadge icon="📆" count={preview.yearCount} label="年鉴" color="#f97316" />}
                
                {preview.diaryCount === 0 && preview.weekCount === 0 && (
                   <span className={styles.emptyPrompt}>所选时间内无相关记忆数据</span>
                )}
              </div>
            ) : (
              <div className={styles.emptyPrompt}>暂无数据</div>
            )}
          </div>
        </div>

        <div className={styles.footer}>
           <button 
             className={styles.injectBtn} 
             onClick={handleConfirm}
             disabled={isLoading || !preview || preview.text.length === 0}
           >
              发送记忆摘要
           </button>
        </div>
      </div>
    </>
  );
};

const StatBadge: React.FC<{ icon: string; count: number; label: string; color: string }> = ({ icon, count, label, color }) => (
  <div className={styles.statBadge} style={{ '--badge-c': color } as any}>
    <span className={styles.badgeIcon}>{icon}</span>
    <span className={styles.badgeCount}>{count}</span>
    <span className={styles.badgeLabel}>{label}</span>
  </div>
);
