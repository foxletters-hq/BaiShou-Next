import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeHighlight from 'rehype-highlight';
import rehypeKatex from 'rehype-katex';
import 'highlight.js/styles/github-dark.css';
import 'katex/dist/katex.min.css';
import styles from './MarkdownRenderer.module.css';

export interface MarkdownRendererProps {
  content: string;
  isStreaming?: boolean;
}

function remarkBrToBreak() {
  return (tree: any) => {
    const walk = (node: any) => {
      // Find embedded HTML matching <br> and turn them into native remark 'break' nodes
      if (node.type === 'html' && /<br\s*\/?>/i.test(node.value)) {
        node.type = 'break';
        delete node.value;
      }
      if (node.children && Array.isArray(node.children)) {
        node.children.forEach(walk);
      }
    };
    walk(tree);
  };
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, isStreaming = false }) => {
  return (
    <div className={`${styles.markdownContainer} ${isStreaming ? styles.streaming : ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkBrToBreak, remarkGfm, remarkMath]}
        rehypePlugins={[rehypeHighlight, rehypeKatex]}
        components={{
          ul: ({ node, ...props }) => <ul className={styles.list} {...props} />,
          ol: ({ node, ...props }) => <ol className={styles.list} {...props} />,
          li: ({ node, ...props }) => <li className={styles.listItem} {...props} />,
          p: ({ node, ...props }) => <p className={styles.paragraph} {...props} />,
          em: ({ node, ...props }) => <em className={styles.italicAnnotation} {...props} />,
          a: ({ node, ...props }) => <a className={styles.link} target="_blank" rel="noopener noreferrer" {...props} />,
          code({ node, className, children, inline, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '');
            return !inline && match ? (
              <pre className={styles.codeWrapper}>
                <div className={styles.codeHeader}>
                  <span>{match[1]}</span>
                  <button onClick={() => navigator.clipboard.writeText(String(children))}>复制</button>
                </div>
                <div className={styles.codeBlock}>
                  <code className={className} {...props}>{children}</code>
                </div>
              </pre>
            ) : (
              <code className={styles.inlineCode} {...props}>{children}</code>
            );
          },
          table({ children }) {
            return <div className={styles.tableWrap}><table>{children}</table></div>;
          },
        blockquote: ({ node, ...props }) => <blockquote className={styles.blockquote} {...props} />,
        }}
      >
        {content + (isStreaming ? ' ▍' : '')}
      </ReactMarkdown>
    </div>
  );
};
