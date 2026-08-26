import type { Language } from '../db/types'
import { translate } from '../i18n/translations'
import { useMetaSetting } from './useMetaSetting'

export function useTranslation() {
  const [lang] = useMetaSetting<Language>('language', 'en')
  function t(text: string): string {
    return translate(lang, text)
  }
  return { t, lang }
}
