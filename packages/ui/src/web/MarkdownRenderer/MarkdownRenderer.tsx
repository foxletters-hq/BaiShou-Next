import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';
import styles from './MarkdownRenderer.module.css';

export interface MarkdownRendererProps {
  content: string;
  isStreaming?: boolean;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, isStreaming = false }) => {
  return (
    <div className={`${styles.markdownContainer} ${isStreaming ? styles.streaming : ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          ul: ({ node, ...props }) => <ul className={styles.list} {...props} />,
          ol: ({ node, ...props }) => <ol className={styles.list} {...props} />,
          li: ({ node, ...props }) => <li className={styles.listItem} {...props} />,
          p: ({ node, ...props }) => <p className={styles.paragraph} {...props} />,
          em: ({ node, ...props }) => <em className={styles.italicAnnotation} {...props} />,
          a: ({ node, ...props }) => <a className={styles.link} target="_blank" rel="noopener noreferrer" {...props} />,
          code: ({ node, inline, ...props }: any) => {
            if (inline) {
              return <code className={styles.inlineCode} {...props} />;
            }
            return (
              <div className={styles.codeBlock}>
                <code {...props} />
              </div>
            );
          },
          blockquote: ({ node, ...props }) => <blockquote className={styles.blockquote} {...props} />,
        }}
      >
        {content}
      </ReactMarkdown>
      {isStreaming && <span className={styles.blinkingCursor}>▋</span>}
    </div>
  );
};
