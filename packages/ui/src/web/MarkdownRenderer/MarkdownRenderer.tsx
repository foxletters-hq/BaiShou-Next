import React from 'react'
import { useTranslation } from 'react-i18next'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeHighlight from 'rehype-highlight'
import rehypeKatex from 'rehype-katex'
import 'highlight.js/styles/github-dark.css'
import 'katex/dist/katex.min.css'
import styles from './MarkdownRenderer.module.css'
import { ContextMenu, ContextMenuItem } from '../ContextMenu'
import { useDialog } from '../Dialog'
import { useToast } from '../Toast/useToast'
import { Copy, FolderOpen, Trash2 } from 'lucide-react'

export interface MarkdownRendererProps {
  content: string
  isStreaming?: boolean
  basePath?: string
  /** 纯文本模式：跳过 remarkCjkFriendly，避免在 CJK/ASCII 之间插入空格 */
  plainText?: boolean
}

function remarkBrToBreak() {
  return (tree: any) => {
    const walk = (node: any) => {
      // Find embedded HTML matching <br> and turn them into native remark 'break' nodes
      if (node.type === 'html' && /<br\s*\/?>/i.test(node.value)) {
        node.type = 'break'
        delete node.value
      }
      if (node.children && Array.isArray(node.children)) {
        node.children.forEach(walk)
      }
    }
    walk(tree)
  }
}

// 预处理内容中的图片宽度语法，将 ![alt](src | width) 转换为 ![alt](src?width=width) 以确保 ReactMarkdown 能正确解析为 img 节点
const preprocessContent = (text: string): string => {
  return text.replace(/!\[([^\]]*)\]\(([^ |)]+)\s*\|\s*(\d+)\)/g, '![$1]($2?width=$3)')
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  isStreaming = false,
  basePath,
  plainText = false
}) => {
  const { t } = useTranslation()
  const toast = useToast()
  const dialog = useDialog()

  const processedContent = React.useMemo(() => {
    return preprocessContent(content)
  }, [content])

  const resolveAttachment = (src?: string) => {
    if (src && basePath && src.startsWith('attachment/')) {
      const normalizedBase = basePath.replace(/\\/g, '/')
      const normalizedName = src.replace('attachment/', '')
      return `local:///${normalizedBase}/${normalizedName}`
    }
    return src
  }

  // 解析图片 src 中的宽度语法：src|475 或 src "475" 或 src?width=475
  const parseImgWidth = (rawSrc?: string): { src: string; width?: number } => {
    if (!rawSrc) return { src: '' }
    // 先匹配 query param width=...
    const urlMatch = rawSrc.match(/^(.+?)\?(?:.+&)?width=(\d+)(?:&.*)?$/)
    if (urlMatch) {
      return { src: urlMatch[1]!, width: parseInt(urlMatch[2]!, 10) }
    }
    // 解码 URL 编码，再匹配
    const decoded = rawSrc.replace(/%7C/gi, '|')
    let m = decoded.match(/^(.+?)\s*\|\s*(\d+)$/)
    if (m) return { src: (m[1] ?? '').trim(), width: parseInt(m[2]!, 10) }
    // src "475" 语法
    m = decoded.match(/^(.+?)\s+"(\d+)"$/)
    if (m) return { src: (m[1] ?? '').trim(), width: parseInt(m[2]!, 10) }
    return { src: rawSrc }
  }

  const remarkPlugins = [remarkBrToBreak, remarkGfm, remarkMath]

  return (
    <div className={`${styles.markdownContainer} ${isStreaming ? styles.streaming : ''}`}>
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={[rehypeHighlight, rehypeKatex]}
        components={{
          ul: ({ node, ...props }) => <ul className={styles.list} {...props} />,
          ol: ({ node, ...props }) => <ol className={styles.list} {...props} />,
          li: ({ node, ...props }) => <li className={styles.listItem} {...props} />,
          p: ({ node, ...props }) => <p className={styles.paragraph} {...props} />,
          em: ({ node, ...props }) => <em className={styles.italicAnnotation} {...props} />,
          a: ({ node, ...props }) => (
            <a className={styles.link} target="_blank" rel="noopener noreferrer" {...props} />
          ),
          img: ({ node, ...props }) => {
            const { src: cleanSrc, width } = parseImgWidth(props.src)
            const resolvedSrc = resolveAttachment(cleanSrc)
            const isLocal = cleanSrc && basePath && cleanSrc.startsWith('attachment/')

            const renderImg = () => (
              <img
                {...props}
                src={resolvedSrc}
                style={{
                  maxWidth: '100%',
                  width: width || undefined,
                  borderRadius: '8px',
                  cursor: isLocal ? 'context-menu' : 'default'
                }}
              />
            )

            if (isLocal) {
              const normalizedBase = basePath!.replace(/\\/g, '/')
              const normalizedName = cleanSrc!.replace('attachment/', '')
              const absolutePath = `${normalizedBase}/${normalizedName}`

              const menuItems: ContextMenuItem[] = [
                {
                  label: t('markdown.copy_image', '复制图片'),
                  icon: <Copy size={14} />,
                  onClick: async () => {
                    try {
                      const res = await (window as any).api?.diary?.copyAttachment(absolutePath)
                      if (res?.success) {
                        toast.showSuccess(t('markdown.copy_image_success', '图片已复制到剪贴板'))
                      } else {
                        toast.showError(res?.error || t('markdown.copy_image_failed', '复制失败'))
                      }
                    } catch (err: any) {
                      toast.showError(err.message)
                    }
                  }
                },
                {
                  label: t('markdown.open_folder', '打开所在文件夹'),
                  icon: <FolderOpen size={14} />,
                  onClick: async () => {
                    try {
                      await (window as any).api?.diary?.openAttachmentFolder(absolutePath)
                    } catch (err: any) {
                      toast.showError(err.message)
                    }
                  }
                },
                {
                  divider: true,
                  label: '',
                  onClick: () => {}
                },
                {
                  label: t('markdown.delete_attachment', '删除附件'),
                  icon: <Trash2 size={14} style={{ color: 'var(--color-error)' }} />,
                  onClick: async () => {
                    const confirmed = await dialog.confirm(
                      t(
                        'markdown.delete_attachment_confirm',
                        '确定要删除此附件图片吗？该操作不可逆，且正文 Markdown 引用不会被清除。'
                      )
                    )
                    if (!confirmed) return

                    try {
                      const res = await (window as any).api?.diary?.deleteAttachment(absolutePath)
                      if (res?.success) {
                        toast.showSuccess(
                          t(
                            'markdown.delete_attachment_success',
                            '附件物理文件已成功删除。若要清理正文占位，请编辑日记移除 Markdown 引用。'
                          )
                        )
                      } else {
                        toast.showError(
                          res?.error || t('markdown.delete_attachment_failed', '删除失败')
                        )
                      }
                    } catch (err: any) {
                      toast.showError(err.message)
                    }
                  }
                }
              ]

              return <ContextMenu items={menuItems}>{renderImg()}</ContextMenu>
            }

            return renderImg()
          },
          video: ({ node, ...props }) => (
            <video
              {...props}
              src={resolveAttachment(props.src)}
              style={{ maxWidth: '100%', borderRadius: '8px' }}
              controls
            />
          ),
          audio: ({ node, ...props }) => (
            <audio
              {...props}
              src={resolveAttachment(props.src)}
              style={{ width: '100%' }}
              controls
            />
          ),
          code({ node, className, children, inline, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '')
            return !inline && match ? (
              <pre className={styles.codeWrapper}>
                <div className={styles.codeHeader}>
                  <span>{match[1]}</span>
                  <button onClick={() => navigator.clipboard.writeText(String(children))}>
                    {t('markdown.copy', '复制')}
                  </button>
                </div>
                <div className={styles.codeBlock}>
                  <code className={className} {...props}>
                    {children}
                  </code>
                </div>
              </pre>
            ) : (
              <code className={styles.inlineCode} {...props}>
                {children}
              </code>
            )
          },
          table({ children }) {
            return (
              <div className={styles.tableWrap}>
                <table>{children}</table>
              </div>
            )
          },
          blockquote: ({ node, ...props }) => (
            <blockquote className={styles.blockquote} {...props} />
          )
        }}
      >
        {processedContent + (isStreaming ? ' ▍' : '')}
      </ReactMarkdown>
    </div>
  )
}
