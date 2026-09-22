import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import { translations, type UiLocale } from "./translations";
import { loadLanguage, uiLocaleFor } from "@/lib/language";

// Transposes translations.ts's own key -> {locale: text} table into the
// {locale: {key: text}} shape react-i18next's resources option wants --
// keeps the source-of-truth table organized by key (one row per string,
// every language visible at once) while still feeding i18next its usual
// per-locale bundles.
const locales: UiLocale[] = ["en", "pt-BR", "es", "fr", "de", "zh", "ja"];
const resources = Object.fromEntries(
  locales.map((locale) => [
    locale,
    { translation: Object.fromEntries(Object.entries(translations).map(([key, row]) => [key, row[locale]])) },
  ]),
);

void i18next.use(initReactI18next).init({
  resources,
  lng: uiLocaleFor(loadLanguage()),
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export default i18next;
