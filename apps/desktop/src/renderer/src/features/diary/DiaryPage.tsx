import React, { useState } from 'react';
import { DiaryCard, TimelineNode } from '@baishou/ui';
import './DiaryPage.css';

// TODO: [Agent1-Dependency] 合并后替换为 import { useTranslation } from 'react-i18next'
const useTranslation = (): { t: (key: string) => string } => ({
  t: (key: string) => key,
});

export const DiaryPage: React.FC = () => {
  const { t } = useTranslation();
  
  // Mock 数据
  const [diaries] = useState([
    {
      id: '1',
      contentSnippet: '今天的天气绝佳，阳光明媚。完成了早上的冥想和跑步，开始处理手头的 Agent 架构...',
      tags: ['日常', '工作', '冥想'],
      createdAt: new Date(),
    },
    {
      id: '2',
      contentSnippet: '复刻 BaiShou v3.0 的 UI 是一项庞大而精妙的工程，尤其是双端同时推进时的体验一致性考量。',
      tags: ['开发笔记', 'UI设计'],
      createdAt: new Date(Date.now() - 3600000),
    }
  ]);

  return (
    <div className="diary-page-container">
      <header className="diary-page-header">
        <h1 className="diary-page-title">{t('diary.title')}</h1>
        <button className="diary-page-add-btn">{t('diary.editor.new')}</button>
      </header>
      
      <div className="diary-page-content">
        <div className="timeline-container">
          {diaries.map((diary, index) => (
            <TimelineNode key={diary.id} isLast={index === diaries.length - 1} isFirst={index === 0}>
              <DiaryCard 
                id={diary.id}
                contentSnippet={diary.contentSnippet}
                tags={diary.tags}
                createdAt={diary.createdAt}
                onClick={() => console.log('Open diary:', diary.id)}
              />
            </TimelineNode>
          ))}
        </div>
      </div>
    </div>
  );
};
