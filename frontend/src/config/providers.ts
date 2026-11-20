// Provider catalogs for the agent editor. `configured` says whether our backend has a key for
// the provider; unconfigured providers are shown but marked, so nobody picks one that can't work.

export interface ModelOption {
  id: string;
  label: string;
  note?: string;
}

export interface VoiceOption {
  id: string;
  name: string;
  gender: "female" | "male";
  languages: string[]; // language codes this voice speaks well
  accent?: string;
}

export interface Provider {
  id: string;
  label: string;
  configured: boolean;
  models: ModelOption[];
}

export interface VoiceProvider extends Provider {
  voices: VoiceOption[];
}

export const llmProviders: Provider[] = [
  {
    id: "openai",
    label: "OpenAI",
    configured: true,
    models: [
      { id: "gpt-4.1", label: "gpt-4.1" },
      { id: "gpt-4.1-mini", label: "gpt-4.1-mini", note: "Recommended for voice" },
      { id: "gpt-4o", label: "gpt-4o" },
      { id: "gpt-4o-mini", label: "gpt-4o-mini", note: "Lowest cost" },
    ],
  },
  {
    id: "gemini",
    label: "Google Gemini",
    configured: true,
    models: [
      { id: "gemini-2.5-flash", label: "gemini-2.5-flash" },
      { id: "gemini-2.5-pro", label: "gemini-2.5-pro" },
    ],
  },
  { id: "sarvam", label: "Sarvam", configured: false, models: [{ id: "sarvam-m", label: "sarvam-m" }] },
  { id: "groq", label: "Groq", configured: false, models: [{ id: "llama-3.3-70b-versatile", label: "llama-3.3-70b" }] },
  { id: "azure-openai", label: "Azure OpenAI", configured: false, models: [{ id: "gpt-4.1-mini", label: "gpt-4.1-mini" }] },
];

export const voiceProviders: VoiceProvider[] = [
  {
    id: "cartesia",
    label: "Cartesia",
    configured: true,
    models: [
      { id: "sonic-3", label: "Sonic 3", note: "Lowest latency" },
      { id: "sonic-2", label: "Sonic 2" },
    ],
    voices: [
      { id: "cartesia-aanya", name: "Aanya", gender: "female", languages: ["en", "hi"], accent: "Indian" },
      { id: "cartesia-ishaan", name: "Ishaan", gender: "male", languages: ["en", "hi"], accent: "Indian" },
      { id: "cartesia-meera", name: "Meera", gender: "female", languages: ["en", "hi", "ta"], accent: "Indian" },
      { id: "cartesia-riya", name: "Riya", gender: "female", languages: ["en"], accent: "Neutral" },
    ],
  },
  {
    id: "sarvam",
    label: "Sarvam",
    configured: true,
    models: [
      { id: "bulbul:v3", label: "Bulbul v3", note: "Best for Indian languages" },
      { id: "bulbul:v2", label: "Bulbul v2" },
    ],
    voices: [
      { id: "ritu", name: "Ritu", gender: "female", languages: ["bn", "hi", "en", "ta", "te", "kn", "ml", "mr", "gu", "pa", "or"] },
      { id: "anushka", name: "Anushka", gender: "female", languages: ["hi", "en", "ta", "te", "kn", "ml", "bn", "mr"] },
      { id: "vidya", name: "Vidya", gender: "female", languages: ["hi", "en", "ta", "te", "kn", "bn"] },
      { id: "manisha", name: "Manisha", gender: "female", languages: ["hi", "en", "mr", "gu"] },
      { id: "abhilash", name: "Abhilash", gender: "male", languages: ["hi", "en", "ta", "te", "kn", "ml"] },
      { id: "karun", name: "Karun", gender: "male", languages: ["hi", "en", "bn", "mr"] },
      { id: "hitesh", name: "Hitesh", gender: "male", languages: ["hi", "en", "gu", "pa"] },
    ],
  },
  {
    id: "elevenlabs",
    label: "ElevenLabs",
    configured: false,
    models: [{ id: "eleven_flash_v2_5", label: "Flash v2.5" }],
    voices: [{ id: "el-rachel", name: "Rachel", gender: "female", languages: ["en", "hi"] }],
  },
];

export const transcriberProviders: Provider[] = [
  {
    id: "gemini",
    label: "Gemini Live",
    configured: true,
    models: [{ id: "gemini-3.5-transcribe-live-preview", label: "gemini-3.5-transcribe-live", note: "Multilingual" }],
  },
  {
    id: "sarvam",
    label: "Sarvam",
    configured: true,
    models: [
      { id: "saaras:v3", label: "saaras:v3", note: "Detects end of turn itself" },
      { id: "saarika:v2.5", label: "saarika:v2.5" },
    ],
  },
  {
    id: "deepgram",
    label: "Deepgram",
    configured: false,
    models: [
      { id: "nova-3", label: "nova-3" },
      { id: "nova-2", label: "nova-2" },
    ],
  },
  { id: "azure", label: "Azure Speech", configured: false, models: [{ id: "azure", label: "Standard" }] },
];

export const telephonyProviders = [
  { id: "plivo", label: "Plivo", configured: true },
  { id: "twilio", label: "Twilio", configured: false },
  { id: "exotel", label: "Exotel", configured: false, note: "Coming soon" },
] as const;

export const ambientNoiseOptions = [
  { id: "none", label: "None" },
  { id: "office-ambience", label: "Office ambience" },
  { id: "call-center", label: "Call centre" },
  { id: "hospital-reception", label: "Hospital reception" },
  { id: "coffee-shop", label: "Coffee shop" },
] as const;

function find<T extends { id: string }>(list: T[], id: string | undefined) {
  return list.find((item) => item.id === id);
}

export const findLlmProvider = (id?: string) => find(llmProviders, id);
export const findVoiceProvider = (id?: string) => find(voiceProviders, id);
export const findTranscriberProvider = (id?: string) => find(transcriberProviders, id);

export function voicesFor(providerId: string, language?: string) {
  const voices = findVoiceProvider(providerId)?.voices ?? [];
  return language ? voices.filter((v) => v.languages.includes(language)) : voices;
}
