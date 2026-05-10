import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import 'emoji-picker-element';
import type Picker from 'emoji-picker-element/picker';
import type { EmojiClickEvent, NativeEmoji } from 'emoji-picker-element/shared';
import { ImagePlus } from 'lucide-react';
import emojiDataUrl from 'emoji-picker-element-data/en/cldr/data.json?url';
import { useTheme } from '../../hooks';
import { AvatarCropModal } from '../AvatarCropModal';
import styles from './AvatarEditor.module.css';

export interface AvatarEditorProps {
  emoji?: string;
  avatarPath?: string;
  onChange: (type: 'emoji' | 'image', value: string) => void;
  children: React.ReactNode;
}

export const AvatarEditor: React.FC<AvatarEditorProps> = ({ onChange, children }) => {
  const { t } = useTranslation();
  const [showPicker, setShowPicker] = useState(false);
  const [showCropModal, setShowCropModal] = useState(false);
  const [tempImageSrc, setTempImageSrc] = useState<string | null>(null);
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

      // Inject i18n translations using t() function
      picker.i18n = {
        categoriesLabel: t('avatarEditor.categoriesLabel', '类别'),
        emojiUnsupportedMessage: t('avatarEditor.emojiUnsupportedMessage', '你的浏览器不支持彩色表情符号'),
        favoritesLabel: t('avatarEditor.favoritesLabel', '收藏'),
        loadingMessage: t('avatarEditor.loadingMessage', '加载中…'),
        networkErrorMessage: t('avatarEditor.networkErrorMessage', '无法加载表情符号'),
        regionLabel: t('avatarEditor.regionLabel', '表情符号选择器'),
        searchDescription: t('avatarEditor.searchDescription', '有搜索结果时，按键盘选择。'),
        searchLabel: t('avatarEditor.searchLabel', '搜索'),
        searchResultsLabel: t('avatarEditor.searchResultsLabel', '搜索结果'),
        skinToneDescription: t('avatarEditor.skinToneDescription', '展开时选择肤色。'),
        skinToneLabel: t('avatarEditor.skinToneLabel', '选择肤色（当前肤色：{skinTone}）'),
        skinTonesLabel: t('avatarEditor.skinTonesLabel', '肤色'),
        skinTones: [
          t('avatarEditor.skinTones.default', '默认'),
          t('avatarEditor.skinTones.light', '浅色'),
          t('avatarEditor.skinTones.mediumLight', '中浅色'),
          t('avatarEditor.skinTones.medium', '中等'),
          t('avatarEditor.skinTones.mediumDark', '中深色'),
          t('avatarEditor.skinTones.dark', '深色')
        ],
        categories: {
          custom: t('avatarEditor.categories.custom', '自定义'),
          'smileys-emotion': t('avatarEditor.categories.smileysEmotion', '表情与情感'),
          'people-body': t('avatarEditor.categories.peopleBody', '人物与身体'),
          'animals-nature': t('avatarEditor.categories.animalsNature', '动物与自然'),
          'food-drink': t('avatarEditor.categories.foodDrink', '食物与饮料'),
          'travel-places': t('avatarEditor.categories.travelPlaces', '旅行与地点'),
          activities: t('avatarEditor.categories.activities', '活动'),
          objects: t('avatarEditor.categories.objects', '物品'),
          symbols: t('avatarEditor.categories.symbols', '符号'),
          flags: t('avatarEditor.categories.flags', '旗帜')
        }
      };

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
  }, [onChange, showPicker, t]);

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
            setTempImageSrc(ev.target.result);
            setShowCropModal(true);
          }
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
    setShowPicker(false);
  };

  const cancelCrop = () => {
    setShowCropModal(false);
    setTempImageSrc(null);
  };

  const finishCrop = (croppedUrl: string) => {
    onChange('image', croppedUrl);
    setShowCropModal(false);
    setTempImageSrc(null);
  };

  return (
    <>
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
                 <span className={styles.popoverTitle}>{t('avatarEditor.personalizeIcon', '个性化图标')}</span>
                 <button 
                    className={styles.uploadBtnIcon} 
                    onClick={triggerImageInput} 
                    title={t('avatarEditor.uploadImageAsAvatar', '从本地上传图片作为头像')}
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

      {showCropModal && tempImageSrc && (
        <AvatarCropModal 
          imageSrc={tempImageSrc}
          onCanceled={cancelCrop}
          onCropped={finishCrop}
        />
      )}
    </>
  );
};
