import React from 'react';
import { useNavigate } from 'react-router-dom';
import { InputBar } from '@baishou/ui';
import { MdAutoAwesome } from 'react-icons/md';
import styles from './AgentHome.module.css';

/**
 * /agent 路由的右侧空态落地页。
 * 1:1 还原 Flutter 版本的 AgentChatEmptyState：
 * - 上方居中的星芒图标（原版的 LinearGradient 渐变圆底）
 * - 中间"开始新的对话"标题
 * - 下方固定的 InputBar（与 AgentScreen 共享同款胶囊输入框）
 */
export const AgentHomePage: React.FC = () => {
  const navigate = useNavigate();

  const handleSend = (text: string) => {
    // 直接发起新会话并携带第一条消息
    const newId = `new-${Date.now()}`;
    navigate(`/c/${newId}?init=${encodeURIComponent(text)}`);
  };

  return (
    <div className={styles.emptyPanel}>
      <div className={styles.emptyContent}>
        <div className={styles.iconCircle}>
          <MdAutoAwesome className={styles.awesomeIcon} />
        </div>
        <h2 className={styles.emptyTitle}>开始新的对话</h2>
        <p className={styles.emptySubtitle}>在下方输入框随便说点什么，或者点击左侧发起新对话～</p>
      </div>

      {/* 与原版完全对齐：底部固定输入栏 */}
      <div className={styles.inputDock}>
        <InputBar
          isLoading={false}
          onSend={handleSend}
        />
      </div>
    </div>
  );
};
