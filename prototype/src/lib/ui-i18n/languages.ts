/**
 * BISVEDA — UI language list (lib/ui-i18n/languages.ts, P12.4)
 *
 * Client-safe (no server imports): English plus the 22 languages in the Eighth Schedule of the
 * Constitution. Used by the language picker and the page translator.
 */

export interface UiLanguage {
  code: string;
  /** English name, shown as a subtitle in the picker and used for search. */
  name: string;
  /** Name written in the language's own script. */
  native: string;
}

export const UI_LANGUAGES: UiLanguage[] = [
  { code: "en", name: "English", native: "English" },
  { code: "hi", name: "Hindi", native: "हिन्दी" },
  { code: "bn", name: "Bengali", native: "বাংলা" },
  { code: "te", name: "Telugu", native: "తెలుగు" },
  { code: "mr", name: "Marathi", native: "मराठी" },
  { code: "ta", name: "Tamil", native: "தமிழ்" },
  { code: "ur", name: "Urdu", native: "اردو" },
  { code: "gu", name: "Gujarati", native: "ગુજરાતી" },
  { code: "kn", name: "Kannada", native: "ಕನ್ನಡ" },
  { code: "or", name: "Odia", native: "ଓଡ଼ିଆ" },
  { code: "pa", name: "Punjabi", native: "ਪੰਜਾਬੀ" },
  { code: "ml", name: "Malayalam", native: "മലയാളം" },
  { code: "as", name: "Assamese", native: "অসমীয়া" },
  { code: "mai", name: "Maithili", native: "मैथिली" },
  { code: "sat", name: "Santali", native: "ᱥᱟᱱᱛᱟᱲᱤ" },
  { code: "ks", name: "Kashmiri", native: "کٲشُر" },
  { code: "ne", name: "Nepali", native: "नेपाली" },
  { code: "sd", name: "Sindhi", native: "سنڌي" },
  { code: "kok", name: "Konkani", native: "कोंकणी" },
  { code: "doi", name: "Dogri", native: "डोगरी" },
  { code: "mni", name: "Manipuri", native: "মৈতৈলোন্" },
  { code: "sa", name: "Sanskrit", native: "संस्कृतम्" },
  { code: "brx", name: "Bodo", native: "बड़ो" },
];

export function findLanguage(code: string): UiLanguage {
  return UI_LANGUAGES.find((l) => l.code === code) || UI_LANGUAGES[0];
}
