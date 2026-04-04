import { useTranslation } from 'react-i18next';
import React, { useState } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, 
  Platform, UIManager, LayoutAnimation, Modal 
} from 'react-native';
import Slider from '@react-native-community/slider';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface AppearanceSettingsProps {
  themeMode: 'system' | 'light' | 'dark';
  seedColor: string;
  language: 'system' | 'zh' | 'en' | 'ja' | 'zh-TW';
  onThemeModeChange: (mode: 'system' | 'light' | 'dark') => void;
  onSeedColorChange: (color: string) => void;
  onLanguageChange: (lang: 'system' | 'zh' | 'en' | 'ja' | 'zh-TW') => void;
}

// TODO: [Agent1-Dependency] 替换


function hslToHex(h: number, s: number, l: number) {
  l /= 100;
  const a = s * Math.min(l, 1 - l) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export const AppearanceSettingsCard: React.FC<AppearanceSettingsProps> = ({
  themeMode, seedColor, language, 
  onThemeModeChange, onSeedColorChange, onLanguageChange
}) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  
  const [showColorModal, setShowColorModal] = useState(false);
  const [hue, setHue] = useState(0);
  const [sat, setSat] = useState(100);
  const [lit, setLit] = useState(50);

  const previewColor = hslToHex(hue, sat, lit);

  const toggleExpand = () => {
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(!expanded);
  };

  const openColorPicker = () => {
  setHue(190); setSat(60); setLit(75);
    setShowColorModal(true);
  };

  const saveColor = () => {


    onSeedColorChange(previewColor);
    setShowColorModal(false);
  };

  return (
    <View style={styles.card}>
      <TouchableOpacity 
        style={styles.header}
        onPress={toggleExpand}
        activeOpacity={0.7}
      >
        <Text style={styles.icon}>🎨</Text>
        <View style={styles.headerBody}>
          <Text style={styles.title}>{t('settings.appearance') || '外观与多语言'}</Text>
          <Text style={styles.subtitle}>{themeMode} · {language}</Text>
        </View>
        <Text style={[styles.arrow, { transform: [{ rotate: expanded ? '180deg' : '0deg' }] }]}>▼</Text>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.content}>
          <Text style={styles.label}>{t('settings.theme_mode') || '主题模式'}</Text>
          <View style={styles.segmentedControl}>
            {(['system', 'light', 'dark'] as const).map((mode, index) => (
              <TouchableOpacity
                key={mode}
                activeOpacity={0.6}
                style={[
                  styles.segmentBtn,
                  themeMode === mode && styles.segmentBtnActive,
                  index === 2 && { borderRightWidth: 0 }
                ]}
                onPress={() => onThemeModeChange(mode)}
              >
                <Text style={[styles.segmentText, themeMode === mode && styles.segmentTextActive]}>
                  {mode === 'system' ? t('settings.theme_system', '跟随系统') : mode === 'light' ? t('settings.theme_light', '浅色') : t('settings.theme_dark', '深色')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.label, { marginTop: 16 }]}>{t('settings.theme_color') || '种子主题色'}</Text>
          <View style={styles.colorWrap}>
            <TouchableOpacity 
              activeOpacity={0.8}
              style={[
                styles.colorOption, 
                { backgroundColor: '#9AD4EA' },
                seedColor === '#9AD4EA' && styles.colorOptionActive
              ]}
              onPress={() => onSeedColorChange('#9AD4EA')}
            >
              {seedColor === '#9AD4EA' && <Text style={styles.checkIcon}>✓</Text>}
            </TouchableOpacity>
            <TouchableOpacity 
              activeOpacity={0.8}
              style={[
                styles.customColorBtn,
                seedColor !== '#9AD4EA' && { borderColor: '#5BA8F5', borderWidth: 2 }
              ]}
              onPress={openColorPicker}
            >
              {seedColor !== '#9AD4EA' ? (
                 <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: seedColor }} />
              ) : (
                <Text style={styles.addIcon}>+</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          <Text style={styles.label}>{t('settings.language') || '显示语言'}</Text>
          <View style={styles.langWrap}>
            {(['system', 'zh', 'zh-TW', 'en', 'ja'] as const).map(lang => (
              <TouchableOpacity
                key={lang}
                activeOpacity={0.6}
                style={[styles.langChip, language === lang && styles.langChipActive]}
                onPress={() => onLanguageChange(lang)}
              >
                <Text style={[styles.langText, language === lang && styles.langTextActive]}>{lang}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* 完整一比一复刻自定义 HSL Modal 弹窗逻辑隔离，本身保留纯 UI 特性 */}
      <Modal visible={showColorModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{t('settings.custom_color') || '自定义颜色'}</Text>
            
            <View style={[styles.colorPreview, { backgroundColor: previewColor, shadowColor: previewColor }]} />
            
            <View style={styles.sliderRow}>
              <Text style={styles.sliderLabel}>{t('settings.theme_hue', '色相')}</Text>
              <Slider
                style={{ flex: 1, height: 40 }}
                minimumValue={0}
                maximumValue={360}
                value={hue}
                onValueChange={setHue}
                minimumTrackTintColor={previewColor}
                thumbTintColor={previewColor}
              />
            </View>
            <View style={styles.sliderRow}>
              <Text style={styles.sliderLabel}>{t('settings.theme_saturation', '饱和')}</Text>
              <Slider
                style={{ flex: 1, height: 40 }}
                minimumValue={0}
                maximumValue={100}
                value={sat}
                onValueChange={setSat}
                minimumTrackTintColor={previewColor}
                thumbTintColor={previewColor}
              />
            </View>
            <View style={styles.sliderRow}>
              <Text style={styles.sliderLabel}>{t('settings.theme_lightness', '明度')}</Text>
              <Slider
                style={{ flex: 1, height: 40 }}
                minimumValue={20}
                maximumValue={90}
                value={lit}
                onValueChange={setLit}
                minimumTrackTintColor={previewColor}
                thumbTintColor={previewColor}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setShowColorModal(false)} style={styles.modalBtn}>
                <Text style={styles.modalBtnTextGray}>{t('common.cancel') || '取消'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={saveColor} style={[styles.modalBtn, { backgroundColor: '#5BA8F5' }]}>
                <Text style={styles.modalBtnTextWhite}>{t('common.save') || '保存'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// ... 原有的 styles.create
const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.5)',
    borderRadius: 16,
    marginBottom: 16,
    marginHorizontal: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  icon: { fontSize: 24, marginRight: 16 },
  headerBody: { flex: 1 },
  title: { fontSize: 16, fontWeight: '500', color: '#1A1A1A' },
  subtitle: { fontSize: 14, color: '#475569', marginTop: 4 },
  arrow: { fontSize: 12, color: '#475569' },
  content: { paddingHorizontal: 16, paddingBottom: 16 },
  label: { fontSize: 14, fontWeight: '500', color: '#1A1A1A', marginBottom: 8 },
  segmentedControl: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.3)',
    borderRadius: 20,
    overflow: 'hidden',
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: 'rgba(148, 163, 184, 0.3)',
  },
  segmentBtnActive: { backgroundColor: 'rgba(91, 168, 245, 0.2)' },
  segmentText: { fontSize: 14, color: '#1A1A1A' },
  segmentTextActive: { fontWeight: 'bold' },
  colorWrap: { flexDirection: 'row', gap: 12 },
  colorOption: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
  },
  colorOptionActive: { borderWidth: 2, borderColor: '#5BA8F5' },
  checkIcon: { color: 'white', fontSize: 20 },
  customColorBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#F2F2F2', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(148, 163, 184, 0.3)',
  },
  addIcon: { fontSize: 20, color: '#475569' },
  divider: { height: 1, backgroundColor: 'rgba(148, 163, 184, 0.2)', marginVertical: 16 },
  langWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  langChip: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(148, 163, 184, 0.3)',
  },
  langChipActive: { backgroundColor: 'rgba(91, 168, 245, 0.2)', borderColor: '#5BA8F5' },
  langText: { fontSize: 14, color: '#1A1A1A' },
  langTextActive: { fontWeight: 'bold' },
  
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center'
  },
  modalBox: {
    width: '85%', backgroundColor: '#FFF', borderRadius: 24, padding: 24, alignItems: 'center'
  },
  modalTitle: {
    fontSize: 18, fontWeight: 'bold', color: '#1A1A1A', marginBottom: 20
  },
  colorPreview: {
    width: 60, height: 60, borderRadius: 30, marginBottom: 20,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8
  },
  sliderRow: {
    flexDirection: 'row', alignItems: 'center', width: '100%', marginBottom: 12
  },
  sliderLabel: {
    width: 40, fontSize: 14, color: '#475569', fontWeight: 'bold'
  },
  modalActions: {
    flexDirection: 'row', justifyContent: 'flex-end', width: '100%', marginTop: 24, gap: 12
  },
  modalBtn: {
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, justifyContent: 'center', alignItems: 'center'
  },
  modalBtnTextGray: { color: '#475569', fontWeight: 'bold' },
  modalBtnTextWhite: { color: '#FFF', fontWeight: 'bold' },
});
