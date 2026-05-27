import React, { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import 'emoji-picker-element'
import type Picker from 'emoji-picker-element/picker'
import type { EmojiClickEvent, NativeEmoji } from 'emoji-picker-element/shared'
import { ImagePlus } from 'lucide-react'
import emojiDataUrl from 'emoji-picker-element-data/en/cldr/data.json?url'
import { useTheme } from '../../hooks'
import { AvatarCropModal } from '../AvatarCropModal'
import styles from './AvatarEditor.module.css'

export interface AvatarEditorProps {
  emoji?: string
  avatarPath?: string
  onChange: (type: 'emoji' | 'image', value: string) => void
  children: React.ReactNode
}

export const AvatarEditor: React.FC<AvatarEditorProps> = ({ onChange, children }) => {
  const { t } = useTranslation()
  const [showPicker, setShowPicker] = useState(false)
  const [showCropModal, setShowCropModal] = useState(false)
  const [tempImageSrc, setTempImageSrc] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const pickerRef = useRef<Picker>(null)
  const { isDark } = useTheme()

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowPicker(false)
      }
    }
    if (showPicker) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showPicker])

  // Bind emoji click listener and attach i18n translation
  useEffect(() => {
    const picker = pickerRef.current
    if (picker && showPicker) {
      // Provide local offline emoji data to prevent CDN timeouts/blocks (e.g. jsdelivr in China)
      picker.dataSource = emojiDataUrl

      // Inject i18n translations using t() function
      picker.i18n = {
        categoriesLabel: t('emoji.categories', 'Categories'),
        emojiUnsupportedMessage: t('emoji.no_native_support', 'Your browser does not support color emoji'),
        favoritesLabel: t('emoji.favorites', 'Favorites'),
        loadingMessage: t('emoji.loading', 'Loading…'),
        networkErrorMessage: t('emoji.error_load', 'Unable to load emoji'),
        regionLabel: t('emoji.picker_title', 'Emoji Picker'),
        searchDescription: t('emoji.keyboard_hint', 'When there are search results, use keyboard to select.'),
        searchLabel: t('emoji.search', 'Search'),
        searchResultsLabel: t('emoji.search_results', 'Search Results'),
        skinToneDescription: t('emoji.skin_tone_hint', 'Select skin tone when expanded.'),
        skinToneLabel: t('emoji.select_skin_tone', 'Select skin tone (current: {{skinTone}})'),
        skinTonesLabel: t('emoji.skin_tone', 'Skin Tone'),
        skinTones: [
          t('emoji.skin_default', 'Default'),
          t('emoji.skin_light', 'Light'),
          t('emoji.skin_medium_light', 'Medium Light'),
          t('emoji.skin_medium', 'Medium'),
          t('emoji.skin_medium_dark', 'Medium Dark'),
          t('emoji.skin_dark', 'Dark')
        ],
        categories: {
          custom: t('emoji.category_custom', 'Custom'),
          'smileys-emotion': t('emoji.category_smileys', 'Smileys & Emotion'),
          'people-body': t('emoji.category_people', 'People & Body'),
          'animals-nature': t('emoji.category_animals', 'Animals & Nature'),
          'food-drink': t('emoji.category_food', 'Food & Drink'),
          'travel-places': t('emoji.category_travel', 'Travel & Places'),
          activities: t('emoji.category_activities', 'Activities'),
          objects: t('emoji.category_objects', 'Objects'),
          symbols: t('emoji.category_symbols', 'Symbols'),
          flags: t('emoji.category_flags', 'Flags')
        }
      }

      // Force hide the search bar and skin tone picker through Shadow DOM
      // since emoji-picker-element does not natively expose these as ::part
      if (picker.shadowRoot) {
        let style = picker.shadowRoot.querySelector('#hide-search-style')
        if (!style) {
          style = document.createElement('style')
          style.id = 'hide-search-style'
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
          `
          picker.shadowRoot.appendChild(style)
        }
      }

      const handleEmojiClick = (event: EmojiClickEvent) => {
        event.stopPropagation()
        const { detail } = event
        // Fallback safely to OS native unicode if detail.unicode not processed
        const unicode =
          detail.unicode || ('unicode' in detail.emoji ? (detail.emoji as NativeEmoji).unicode : '')
        onChange('emoji', unicode)
        setShowPicker(false)
      }
      picker.addEventListener('emoji-click', handleEmojiClick)
      return () => picker.removeEventListener('emoji-click', handleEmojiClick)
    }
  }, [onChange, showPicker, t])

  const triggerImageInput = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/png, image/jpeg, image/webp'
    input.onchange = (e: any) => {
      const file = e.target.files?.[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = (ev) => {
          if (typeof ev.target?.result === 'string') {
            setTempImageSrc(ev.target.result)
            setShowCropModal(true)
          }
        }
        reader.readAsDataURL(file)
      }
    }
    input.click()
    setShowPicker(false)
  }

  const cancelCrop = () => {
    setShowCropModal(false)
    setTempImageSrc(null)
  }

  const finishCrop = (croppedUrl: string) => {
    onChange('image', croppedUrl)
    setShowCropModal(false)
    setTempImageSrc(null)
  }

  return (
    <>
      <div className={styles.editorContainer} ref={containerRef}>
        <div
          onClick={(e) => {
            e.preventDefault()
            setShowPicker(!showPicker)
          }}
          className={styles.triggerWrapper}
        >
          {children}
        </div>

        {showPicker && (
          <div className={styles.popover} onClick={(e) => e.stopPropagation()}>
            <div className={styles.popoverHeader}>
              <span className={styles.popoverTitle}>
                {t('emoji.personalize_avatar', 'Personalize Avatar')}
              </span>
              <button
                className={styles.uploadBtnIcon}
                onClick={triggerImageInput}
                title={t('emoji.upload_avatar_hint', 'Upload an image from your device as avatar')}
              >
                <ImagePlus size={16} />
              </button>
            </div>
            <div className={styles.pickerWrapper}>
              {/* @ts-ignore Since it's a web component */}
              <emoji-picker
                ref={pickerRef}
                class={isDark ? 'dark' : 'light'}
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
        <AvatarCropModal imageSrc={tempImageSrc} onCanceled={cancelCrop} onCropped={finishCrop} />
      )}
    </>
  )
}
