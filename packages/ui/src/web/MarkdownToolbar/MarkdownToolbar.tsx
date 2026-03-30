import React from 'react';
import './MarkdownToolbar.css';

interface MarkdownToolbarProps {
  isPreview: boolean;
  onTogglePreview: () => void;
  onHideKeyboard?: () => void;
  onInsertText: (prefix: string, suffix?: string) => void;
}

export const MarkdownToolbar: React.FC<MarkdownToolbarProps> = ({
  isPreview,
  onTogglePreview,
  onHideKeyboard,
  onInsertText
}) => {
  return (
    <div className="markdown-toolbar">
      <div className="md-tools-scroll">
        <button className="md-tool-btn" onClick={() => onInsertText('**', '**')} title="Bold">B</button>
        <button className="md-tool-btn italic" onClick={() => onInsertText('*', '*')} title="Italic">I</button>
        <button className="md-tool-btn" onClick={() => onInsertText('## ')} title="Heading">H</button>
        
        <div className="md-divider" />
        
        <button className="md-tool-btn" onClick={() => onInsertText('- ')} title="List">≡</button>
        <button className="md-tool-btn" onClick={() => onInsertText('- [ ] ')} title="Todo">☑</button>
        
        <div className="md-divider" />
        
        <button className="md-tool-btn" onClick={() => onInsertText('[', '](url)')} title="Link">🔗</button>
        <button className="md-tool-btn" onClick={() => onInsertText('![', '](image_url)')} title="Image">🖼️</button>
      </div>

      <div className="md-tools-actions">
        <button 
          className={`md-action-btn ${isPreview ? 'preview-active' : ''}`}
          onClick={onTogglePreview}
          title="Toggle Preview"
        >
          {isPreview ? '✎' : '👁️'}
        </button>
        {onHideKeyboard && (
          <button className="md-action-btn" onClick={onHideKeyboard} title="Hide Keyboard">
            ⌨️↓
          </button>
        )}
      </div>
    </div>
  );
};
