import { useEffect, useRef, useState } from 'react';
import { Check, Languages } from 'lucide-react';
import { useLocale, t, type Locale } from '../../hooks/useLocale';

const LANGS: { code: Locale; label: string; translationKey: string }[] = [
  { code: 'vi', label: 'VI', translationKey: 'languageVietnamese' },
  { code: 'en', label: 'EN', translationKey: 'languageEnglish' },
  { code: 'ru', label: 'RU', translationKey: 'languageRussian' },
  { code: 'zh', label: '中文', translationKey: 'languageChinese' },
];

export function LanguageSelector() {
  const { locale, setLocale } = useLocale();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div ref={rootRef} className="relative" id="language-menu">
      <button
        type="button"
        className="icon-btn border border-line inline-flex items-center gap-1.5 px-2.5"
        aria-label={t('chooseLanguage', locale)}
        title={t('chooseLanguage', locale)}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Languages className="w-[18px] h-[18px]" />
        <span className="text-xs font-semibold">{locale.toUpperCase()}</span>
      </button>
      {open && (
        <ul role="menu" aria-label={t('chooseLanguage', locale)} className="absolute right-0 mt-2 w-44 py-1 bg-surface border border-line rounded-xl shadow-lg z-50">
          {LANGS.map((language) => (
            <li key={language.code} role="none">
              <button
                type="button"
                role="menuitemradio"
                aria-checked={locale === language.code}
                className={`w-full flex items-center gap-2 py-2 px-3 text-sm text-left hover:bg-surface-2 ${locale === language.code ? 'text-accent font-semibold' : ''}`}
                onClick={() => {
                  setLocale(language.code);
                  setOpen(false);
                }}
              >
                <span className="w-7 text-xs">{language.label}</span>
                <span className="flex-1">{t(language.translationKey, locale)}</span>
                {locale === language.code && <Check className="w-4 h-4" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
