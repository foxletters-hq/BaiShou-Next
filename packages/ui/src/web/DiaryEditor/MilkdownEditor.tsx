import React, { useRef, useEffect } from 'react';
import { Milkdown, MilkdownProvider, useEditor } from '@milkdown/react';
import { Editor, rootCtx, defaultValueCtx } from '@milkdown/core';
import { commonmark } from '@milkdown/preset-commonmark';
import { gfm } from '@milkdown/preset-gfm';
import { history } from '@milkdown/plugin-history';
import { listener, listenerCtx } from '@milkdown/plugin-listener';
import { clipboard } from '@milkdown/plugin-clipboard';

interface MilkdownEditorProps {
  content: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const EditorComponent: React.FC<MilkdownEditorProps> = ({ content, onChange, placeholder }) => {
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEditor((root) => {
    return Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root);
        ctx.set(defaultValueCtx, content || '');
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

  return <Milkdown />;
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
