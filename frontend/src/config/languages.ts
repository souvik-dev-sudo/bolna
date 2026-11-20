export interface LanguageOption {
  code: string;
  name: string;
  native: string;
}

/** Languages offered in the agent editor. Codes match what Bolna's synthesizer/transcriber expect. */
export const languages: LanguageOption[] = [
  { code: "en", name: "English", native: "English" },
  { code: "hi", name: "Hindi", native: "हिन्दी" },
  { code: "bn", name: "Bengali", native: "বাংলা" },
  { code: "ta", name: "Tamil", native: "தமிழ்" },
  { code: "te", name: "Telugu", native: "తెలుగు" },
  { code: "kn", name: "Kannada", native: "ಕನ್ನಡ" },
  { code: "ml", name: "Malayalam", native: "മലയാളം" },
  { code: "mr", name: "Marathi", native: "मराठी" },
  { code: "gu", name: "Gujarati", native: "ગુજરાતી" },
  { code: "pa", name: "Punjabi", native: "ਪੰਜਾਬੀ" },
  { code: "or", name: "Odia", native: "ଓଡ଼ିଆ" },
];

export const languageByCode = Object.fromEntries(languages.map((l) => [l.code, l])) as Record<string, LanguageOption>;

export function languageName(code: string) {
  return languageByCode[code]?.name ?? code.toUpperCase();
}

/** When the agent may switch away from its starting language. */
export const languageSwitchModes = [
  { value: "auto", label: "requested or auto detected" },
  { value: "requested", label: "requested" },
] as const;
