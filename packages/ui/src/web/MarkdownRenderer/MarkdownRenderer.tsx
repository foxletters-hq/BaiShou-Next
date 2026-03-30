import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import './MarkdownRenderer.css';

interface MarkdownRendererProps {
  content: string;
}

// TODO: [Agent1-Dependency] 合并后替换为 import { useTranslation } from 'react-i18next'
const useTranslation = (): { t: (key: string) => string } => ({
  t: (key: string) => key,
});

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  const { t } = useTranslation();
  
  return (
    <div className="markdown-renderer">
      <ReactMarkdown 
        remarkPlugins={[remarkGfm]} 
        rehypePlugins={[rehypeHighlight]}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
