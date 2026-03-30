import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './en.i18n.json';
import ja from './ja.i18n.json';
import zh from './zh.i18n.json';
import zh_TW from './zh_TW.i18n.json';

export const defaultNS = 'translation';

export const resources = {
  en: { translation: en },
  ja: { translation: ja },
  zh: { translation: zh },
  'zh-TW': { translation: zh_TW },
} as const;

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'zh',
    fallbackLng: 'en',
    ns: [defaultNS],
    defaultNS,
    interpolation: {
      escapeValue: false, // React protects against XSS
    },
  });

export default i18n;
