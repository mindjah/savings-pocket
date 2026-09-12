import { useEffect } from 'react'
import type { Language } from '../db/types'
import { translate } from '../i18n/translations'
import { useMetaSetting } from './useMetaSetting'

const LANG_CACHE_KEY = 'savings-pocket-language'

// useMetaSetting's own value is only known once its Dexie query resolves —
// until then it reports the hard-coded default, which for 'language' means
// every t() call briefly renders in English before flashing to whatever the
// user actually has saved (Russian, say) a moment later. Reading last
// time's resolved language from localStorage synchronously as the DEFAULT
// (instead of always 'en') means that first render already shows the right
// language for a returning visitor — only a genuinely first-ever visit
// (nothing cached yet) still starts in English, which is correct anyway.
function cachedLang(): Language {
  try {
    return localStorage.getItem(LANG_CACHE_KEY) === 'ru' ? 'ru' : 'en'
  } catch {
    return 'en'
  }
}

export function useTranslation() {
  const [lang] = useMetaSetting<Language>('language', cachedLang())

  useEffect(() => {
    try {
      localStorage.setItem(LANG_CACHE_KEY, lang)
    } catch {
      // Best-effort cache only — a write failure just means the next load
      // falls back to English until Dexie's own query resolves, same as
      // before this fix existed.
    }
  }, [lang])

  function t(text: string): string {
    return translate(lang, text)
  }
  return { t, lang }
}
