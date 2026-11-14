import { applyTranslations, resolveLocale, setLocale } from './libs/i18n';

setLocale(resolveLocale());
applyTranslations();
