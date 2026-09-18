// Single source-of-truth translation table -- per explicit request ("we
// should have a table/map where we can see all the same settings and
// translations"), every UI string lives here as one row keyed by its
// translation key, with all seven UI locales as columns side by side,
// instead of seven separate per-locale JSON files that would need to be
// diffed against each other to see whether a key is missing or stale in
// one language. src/i18n/index.ts transposes this into the resources
// shape react-i18next actually wants at init time.
//
// Only the three English LanguageValue variants (en-US/en-IE/en-GB) share
// one "en" column here -- language.ts's own uiLocaleFor collapses them,
// since there's no UI-text difference between English regions, only date
// order/spelling (isMonthFirstDateOrder/spelling.ts) which this table has
// nothing to do with.
//
// Extracted incrementally, page by page (issue #307's own scope note) --
// today this covers Settings -> General (Tips, Language & Timezone,
// Notifications, Caution) as the first end-to-end proof slice. Every other
// page's strings stay hardcoded English until its own extraction pass;
// STYLE_GUIDE.md documents the convention for adding new keys here instead
// of a raw string literal going forward.
export type UiLocale = "en" | "pt-BR" | "es" | "fr" | "de" | "zh" | "ja";

type TranslationRow = Record<UiLocale, string>;

export const translations = {
  "settings.general.tips": {
    en: "Tips",
    "pt-BR": "Dicas",
    es: "Consejos",
    fr: "Astuces",
    de: "Tipps",
    zh: "提示",
    ja: "ヒント",
  },
  "settings.general.gettingStarted.title": {
    en: "Getting started",
    "pt-BR": "Primeiros passos",
    es: "Primeros pasos",
    fr: "Prise en main",
    de: "Erste Schritte",
    zh: "新手入门",
    ja: "はじめに",
  },
  "settings.general.gettingStarted.description": {
    en: "Show the Getting started page and its sidebar entry.",
    "pt-BR": "Mostrar a página de Primeiros passos e seu item na barra lateral.",
    es: "Mostrar la página de Primeros pasos y su entrada en la barra lateral.",
    fr: "Afficher la page Prise en main et son entrée dans la barre latérale.",
    de: "Die Seite „Erste Schritte“ und den zugehörigen Eintrag in der Seitenleiste anzeigen.",
    zh: "显示新手入门页面及其侧边栏条目。",
    ja: "「はじめに」ページとサイドバーの項目を表示します。",
  },
  "settings.general.languageAndTimezone": {
    en: "Language & Timezone",
    "pt-BR": "Idioma e fuso horário",
    es: "Idioma y zona horaria",
    fr: "Langue et fuseau horaire",
    de: "Sprache & Zeitzone",
    zh: "语言和时区",
    ja: "言語とタイムゾーン",
  },
  "settings.general.language.title": {
    en: "Language",
    "pt-BR": "Idioma",
    es: "Idioma",
    fr: "Langue",
    de: "Sprache",
    zh: "语言",
    ja: "言語",
  },
  "settings.general.language.description": {
    en: "Auto detects from your device. Change to your preference.",
    "pt-BR": "Detectado automaticamente pelo seu dispositivo. Altere conforme sua preferência.",
    es: "Se detecta automáticamente desde tu dispositivo. Cámbialo según tu preferencia.",
    fr: "Détectée automatiquement depuis votre appareil. Modifiez-la selon vos préférences.",
    de: "Wird automatisch von deinem Gerät erkannt. Ändere sie nach Belieben.",
    zh: "自动从您的设备检测。可根据您的偏好更改。",
    ja: "デバイスから自動検出されます。お好みに合わせて変更してください。",
  },
  "settings.general.timezone.title": {
    en: "Timezone",
    "pt-BR": "Fuso horário",
    es: "Zona horaria",
    fr: "Fuseau horaire",
    de: "Zeitzone",
    zh: "时区",
    ja: "タイムゾーン",
  },
  "settings.general.notifications": {
    en: "Notifications",
    "pt-BR": "Notificações",
    es: "Notificaciones",
    fr: "Notifications",
    de: "Benachrichtigungen",
    zh: "通知",
    ja: "通知",
  },
  "settings.general.notifyTurnComplete.title": {
    en: "Receive a notification from every chat when a turn completes",
    "pt-BR": "Receber uma notificação de cada conversa quando um turno for concluído",
    es: "Recibir una notificación de cada chat cuando finalice un turno",
    fr: "Recevoir une notification de chaque discussion à la fin d'un tour",
    de: "Bei jedem Chat eine Benachrichtigung erhalten, wenn ein Durchgang abgeschlossen ist",
    zh: "每个对话轮次完成时接收通知",
    ja: "各チャットでターンが完了したら通知を受け取る",
  },
  "settings.general.notifyTurnComplete.description": {
    en: "Every chat delivers a notification when a provider turn finishes while the app is not focused. If disabled, notifications can still be enabled for individual chats.",
    "pt-BR":
      "Cada conversa envia uma notificação quando um turno do provedor termina enquanto o aplicativo não está em foco. Se desativado, as notificações ainda podem ser ativadas para conversas individuais.",
    es: "Cada chat envía una notificación cuando finaliza un turno del proveedor mientras la aplicación no está en primer plano. Si se desactiva, las notificaciones aún se pueden activar para chats individuales.",
    fr: "Chaque discussion envoie une notification lorsqu'un tour du fournisseur se termine pendant que l'application n'est pas au premier plan. Si désactivé, les notifications peuvent toujours être activées pour des discussions individuelles.",
    de: "Jeder Chat sendet eine Benachrichtigung, wenn ein Anbieter-Durchgang abgeschlossen ist, während die App nicht im Fokus ist. Bei Deaktivierung können Benachrichtigungen weiterhin für einzelne Chats aktiviert werden.",
    zh: "当应用未处于焦点状态时，每个对话在服务商轮次结束时都会发送通知。如果关闭此项，仍可为单个对话单独启用通知。",
    ja: "アプリがフォーカスされていないとき、プロバイダーのターンが終了すると各チャットから通知が届きます。無効にした場合でも、個別のチャットごとに通知を有効にできます。",
  },
  "settings.general.caution": {
    en: "Caution",
    "pt-BR": "Cuidado",
    es: "Precaución",
    fr: "Attention",
    de: "Vorsicht",
    zh: "注意",
    ja: "注意",
  },
  "settings.general.resetDefaults.title": {
    en: "Default general settings",
    "pt-BR": "Configurações gerais padrão",
    es: "Configuración general predeterminada",
    fr: "Paramètres généraux par défaut",
    de: "Allgemeine Standardeinstellungen",
    zh: "默认通用设置",
    ja: "デフォルトの一般設定",
  },
  "settings.general.resetDefaults.description": {
    en: "Reset every setting on this page back to its default.",
    "pt-BR": "Redefinir todas as configurações desta página para o padrão.",
    es: "Restablecer todos los ajustes de esta página a sus valores predeterminados.",
    fr: "Réinitialiser tous les paramètres de cette page à leur valeur par défaut.",
    de: "Alle Einstellungen auf dieser Seite auf ihre Standardwerte zurücksetzen.",
    zh: "将此页面上的所有设置重置为默认值。",
    ja: "このページのすべての設定をデフォルトに戻します。",
  },
  "settings.general.resetDefaults.button": {
    en: "Reset",
    "pt-BR": "Redefinir",
    es: "Restablecer",
    fr: "Réinitialiser",
    de: "Zurücksetzen",
    zh: "重置",
    ja: "リセット",
  },
} satisfies Record<string, TranslationRow>;

export type TranslationKey = keyof typeof translations;
