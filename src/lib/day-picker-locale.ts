import { de, enGB, enUS, es, fr, ja, ptBR, zhCN } from "react-day-picker/locale";
import { loadLanguage } from "@/lib/language";

// The date picker's own translations (month and weekday names, week start)
// for the app's language. English follows the chosen variant: US, or the
// UK/IE form (day-first, weeks from Monday).
export function dayPickerLocale(language: string) {
  switch (language) {
    case "pt-BR":
      return ptBR;
    case "es":
      return es;
    case "fr":
      return fr;
    case "de":
      return de;
    case "zh":
      return zhCN;
    case "ja":
      return ja;
    default:
      return loadLanguage() === "en-US" ? enUS : enGB;
  }
}
