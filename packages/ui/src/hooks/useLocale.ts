import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

export function useLocale() {
  const { i18n } = useTranslation();

  const changeLocale = useCallback(
    (lng: string) => {
      // TODO: [Agent2-Dependency] 未来在此处将语言设置同步到 settings.store
      i18n.changeLanguage(lng);
    },
    [i18n]
  );

  return {
    locale: i18n.language,
    changeLocale,
  };
}
