import React, { useRef, useEffect, useCallback, useState } from 'react';
import { Milkdown, MilkdownProvider, useEditor } from '@milkdown/react';
import { Editor, rootCtx, defaultValueCtx, remarkPluginsCtx } from '@milkdown/core';
import { commonmark } from '@milkdown/preset-commonmark';
import { gfm } from '@milkdown/preset-gfm';
import { history } from '@milkdown/plugin-history';
import { listener, listenerCtx } from '@milkdown/plugin-listener';
import { clipboard } from '@milkdown/plugin-clipboard';
import { ImagePreview } from './ImagePreview';

interface MilkdownEditorProps {
  content: string;
  onChange: (value: string) => void;
  placeholder?: string;
  basePath?: string; // 附件基础路径
}

const EditorComponent: React.FC<MilkdownEditorProps> = ({ content, onChange, placeholder, basePath }) => {
  const onChangeRef = useRef(onChange);
  const containerRef = useRef<HTMLDivElement>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // 处理附件引用的渲染
  const processAttachments = useCallback(() => {
    if (!containerRef.current || !basePath) return;

    const images = containerRef.current.querySelectorAll('img[src^="attachment/"]');
    images.forEach((img) => {
      const src = img.getAttribute('src');
      if (src && !img.getAttribute('data-processed')) {
        const fullPath = `${basePath}/${src.replace('attachment/', '')}`;
        img.setAttribute('data-original-src', src);
        img.setAttribute('data-processed', 'true');
        img.setAttribute('src', fullPath);
        const htmlImg = img as HTMLImageElement;
        htmlImg.style.cursor = 'pointer';
        htmlImg.style.maxWidth = '100%';
        htmlImg.style.height = 'auto';
        htmlImg.style.borderRadius = '8px';
        htmlImg.addEventListener('click', () => setPreviewSrc(fullPath));
      }
    });

    const videos = containerRef.current.querySelectorAll('video[src^="attachment/"]');
    videos.forEach((video) => {
      const src = video.getAttribute('src');
      if (src && !video.getAttribute('data-processed')) {
        const fullPath = `${basePath}/${src.replace('attachment/', '')}`;
        video.setAttribute('data-original-src', src);
        video.setAttribute('data-processed', 'true');
        video.setAttribute('src', fullPath);
        const htmlVideo = video as HTMLVideoElement;
        htmlVideo.style.maxWidth = '100%';
        htmlVideo.style.borderRadius = '8px';
      }
    });

    const audios = containerRef.current.querySelectorAll('audio[src^="attachment/"]');
    audios.forEach((audio) => {
      const src = audio.getAttribute('src');
      if (src && !audio.getAttribute('data-processed')) {
        const fullPath = `${basePath}/${src.replace('attachment/', '')}`;
        audio.setAttribute('data-original-src', src);
        audio.setAttribute('data-processed', 'true');
        audio.setAttribute('src', fullPath);
        const htmlAudio = audio as HTMLAudioElement;
        htmlAudio.style.width = '100%';
      }
    });

    const links = containerRef.current.querySelectorAll('a[href^="attachment/"]');
    links.forEach((link) => {
      const href = link.getAttribute('href');
      if (href && !link.getAttribute('data-processed')) {
        const fullPath = `${basePath}/${href.replace('attachment/', '')}`;
        link.setAttribute('data-original-href', href);
        link.setAttribute('data-processed', 'true');
        link.setAttribute('href', fullPath);
        link.setAttribute('target', '_blank');
        const htmlLink = link as HTMLAnchorElement;
        htmlLink.style.color = 'var(--color-primary)';
        htmlLink.style.textDecoration = 'none';
        htmlLink.style.display = 'inline-flex';
        htmlLink.style.alignItems = 'center';
        htmlLink.style.gap = '4px';
        htmlLink.style.padding = '2px 6px';
        htmlLink.style.borderRadius = '4px';
        htmlLink.style.background = 'var(--bg-secondary)';

        // 添加附件图标
        const icon = document.createElement('span');
        icon.textContent = '📎';
        link.insertBefore(icon, link.firstChild);
      }
    });
  }, [basePath, setPreviewSrc]);

  useEditor((root) => {
    return Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root);
        ctx.set(defaultValueCtx, content || '');
        
        ctx.update(remarkPluginsCtx, (prev) => {
          const remarkBrToBreak: any = () => (tree: any) => {
            const walk = (node: any) => {
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
          return prev.concat(remarkBrToBreak);
        });

        ctx.get(listenerCtx)
          .markdownUpdated((ctx, markdown, prevMarkdown) => {
           // Avoid triggering onChange repeatedly if it's the exact same
             if (markdown !== prevMarkdown) {
               onChangeRef.current(markdown);
             }
          });
      })
      .use(commonmark)
      .use(gfm)
      .use(history)
      .use(clipboard)
      .use(listener);
  }, []); // Empty dependency array prevents unmounting!

  // 内容变化后处理附件
  useEffect(() => {
    const timer = setTimeout(processAttachments, 100);
    return () => clearTimeout(timer);
  }, [content, processAttachments]);

  return (
    <div ref={containerRef}>
      <Milkdown />
      {previewSrc && (
        <ImagePreview
          src={previewSrc}
          isOpen={!!previewSrc}
          onClose={() => setPreviewSrc(null)}
        />
      )}
    </div>
  );
};

export const MilkdownEditorWrapper: React.FC<MilkdownEditorProps> = (props) => {
  return (
    <div 
      className="milkdown-wrapper" 
      style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}
      onClick={(e) => {
        const pm = e.currentTarget.querySelector('.ProseMirror') as HTMLElement;
        if (pm) pm.focus();
      }}
    >
      <MilkdownProvider>
        <EditorComponent {...props} />
      </MilkdownProvider>
    </div>
  );
};
