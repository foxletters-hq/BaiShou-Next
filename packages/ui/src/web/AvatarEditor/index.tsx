import React, { useState, useRef, useEffect } from 'react';
import 'emoji-picker-element';
import type Picker from 'emoji-picker-element/picker';
import type { EmojiClickEvent, NativeEmoji } from 'emoji-picker-element/shared';
import { ImagePlus } from 'lucide-react';
import emojiDataUrl from 'emoji-picker-element-data/en/cldr/data.json?url';
import { useTheme } from '../../hooks';
import styles from './AvatarEditor.module.css';

export interface AvatarEditorProps {
  emoji?: string;
  avatarPath?: string;
  onChange: (type: 'emoji' | 'image', value: string) => void;
  children: React.ReactNode;
}

// Inline i18n to ensure NO English annotations appear whatsoever
const ZH_CN_I18N = {
  categoriesLabel: '类别',
  emojiUnsupportedMessage: '你的浏览器不支持彩色表情符号',
  favoritesLabel: '收藏',
  loadingMessage: '加载中…',
  networkErrorMessage: '无法加载表情符号',
  regionLabel: '表情符号选择器',
  searchDescription: '有搜索结果时，按键盘选择。',
  searchLabel: '搜索',
  searchResultsLabel: '搜索结果',
  skinToneDescription: '展开时选择肤色。',
  skinToneLabel: '选择肤色（当前肤色：{skinTone}）',
  skinTonesLabel: '肤色',
  skinTones: [
    '默认',
    '浅色',
    '中浅色',
    '中等',
    '中深色',
    '深色'
  ],
  categories: {
    custom: '自定义',
    'smileys-emotion': '表情与情感',
    'people-body': '人物与身体',
    'animals-nature': '动物与自然',
    'food-drink': '食物与饮料',
    'travel-places': '旅行与地点',
    activities: '活动',
    objects: '物品',
    symbols: '符号',
    flags: '旗帜'
  }
};

export const AvatarEditor: React.FC<AvatarEditorProps> = ({ onChange, children }) => {
  const [showPicker, setShowPicker] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<Picker>(null);
  const { isDark } = useTheme();

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    };
    if (showPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPicker]);

  // Bind emoji click listener and attach i18n translation
  useEffect(() => {
    const picker = pickerRef.current;
    if (picker && showPicker) {
      
      // Provide local offline emoji data to prevent CDN timeouts/blocks (e.g. jsdelivr in China)
      picker.dataSource = emojiDataUrl;

      // Inject our internal Chinese definitions 
      // (This overrides any English annotation completely)
      picker.i18n = ZH_CN_I18N;

      // Force hide the search bar and skin tone picker through Shadow DOM
      // since emoji-picker-element does not natively expose these as ::part
      if (picker.shadowRoot) {
        let style = picker.shadowRoot.querySelector('#hide-search-style');
        if (!style) {
          style = document.createElement('style');
          style.id = 'hide-search-style';
          style.textContent = `
            .search-row,
            .search-wrapper,
            [role="search"],
            div.search { 
               display: none !important; 
            }
            .skin-tone-dropdown,
            .skin-tone-button-wrapper,
            [id="skin-tone"] {
               display: none !important;
            }
          `;
          picker.shadowRoot.appendChild(style);
        }
      }
      
      const handleEmojiClick = (event: EmojiClickEvent) => {
        event.stopPropagation();
        const { detail } = event;
        // Fallback safely to OS native unicode if detail.unicode not processed
        const unicode = detail.unicode || ('unicode' in detail.emoji ? (detail.emoji as NativeEmoji).unicode : '');
        onChange('emoji', unicode);
        setShowPicker(false);
      };
      picker.addEventListener('emoji-click', handleEmojiClick);
      return () => picker.removeEventListener('emoji-click', handleEmojiClick);
    }
  }, [onChange, showPicker]);

  const triggerImageInput = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png, image/jpeg, image/webp';
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          if (typeof ev.target?.result === 'string') {
            onChange('image', ev.target.result);
          }
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
    setShowPicker(false);
  };

  return (
    <div className={styles.editorContainer} ref={containerRef}>
      <div 
        onClick={(e) => { e.preventDefault(); setShowPicker(!showPicker); }}
        className={styles.triggerWrapper}
      >
        {children}
      </div>

      {showPicker && (
        <div className={styles.popover} onClick={(e) => e.stopPropagation()}>
           <div className={styles.popoverHeader}>
              <span className={styles.popoverTitle}>个性化图标</span>
              <button 
                 className={styles.uploadBtnIcon} 
                 onClick={triggerImageInput} 
                 title="从本地上传图片作为头像"
              >
                 <ImagePlus size={16} />
              </button>
           </div>
           <div className={styles.pickerWrapper}>
             {/* @ts-ignore Since it's a web component */}
             <emoji-picker 
               ref={pickerRef} 
               class={isDark ? "dark" : "light"} 
               style={{ 
                 width: '100%', 
                 height: '300px', 
                 border: 'none', 
                 background: 'transparent',
                 '--indicator-color': 'var(--color-primary)'
               }} 
             />
           </div>
        </div>
      )}
    </div>
  );
};
