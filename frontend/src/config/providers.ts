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
  gender?: "female" | "male";
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
    // "google" is the engine's provider id for Gemini (LLMProvider.GOOGLE -> GeminiLLM).
    // Local runs need GEMINI_USE_VERTEX=false (then GOOGLE_API_KEY is used); the VM uses Vertex.
    id: "google",
    label: "Google Gemini",
    configured: true,
    // Checked 2026-11-20 with the API key: gemini-2.5-flash / 2.5-pro are "no longer available to
    // new users"; these two answer (both slow on the API key, 9-24 s for one sentence).
    models: [
      { id: "gemini-3.5-flash", label: "gemini-3.5-flash" },
      { id: "gemini-3.5-flash-lite", label: "gemini-3.5-flash-lite" },
    ],
  },
  // No Sarvam entry: the engine has no Sarvam LLM. Groq / Azure work once their keys are set.
  { id: "groq", label: "Groq", configured: false, models: [{ id: "llama-3.3-70b-versatile", label: "llama-3.3-70b" }] },
  { id: "azure-openai", label: "Azure OpenAI", configured: false, models: [{ id: "gpt-4.1-mini", label: "gpt-4.1-mini" }] },
];

const sarvamLanguages = ["en", "hi", "bn", "ta", "te", "mr", "kn", "gu", "ml", "pa", "or"];
const sarvamSpeakers = [
  "aayan", "aditya", "advait", "amit", "anand", "ashutosh", "dev", "gokul",
  "ishita", "kabir", "kavitha", "kavya", "manan", "mani", "mohit", "neha",
  "pooja", "priya", "rahul", "ratan", "rehan", "ritu", "rohan", "roopa",
  "rupali", "shreya", "shruti", "shubh", "simran", "soham", "suhani", "sumit",
  "sunny", "tanya", "tarun", "varun", "vijay",
];

export const voiceProviders: VoiceProvider[] = [
  {
    id: "cartesia",
    label: "Cartesia",
    configured: true,
    models: [
      // sonic-2 is sunsetted by Cartesia ("Model sunsetted").
      { id: "sonic-3", label: "Sonic 3", note: "Lowest latency" },
    ],
    // Real Cartesia voice ids (GET /voices), each TTS-tested on sonic-3 on 2026-11-20.
    // Odia voices fail on sonic-3 ("language not supported"); Hindi voices also speak English.
    voices: [
      { id: "39d518b7-fd0b-4676-9b8b-29d64ff31e12", name: "Aarav", gender: "male", languages: ["en"] },
      { id: "c63361f8-d142-4c62-8da7-8f8149d973d6", name: "Krishna", gender: "male", languages: ["en"] },
      { id: "ce45ddca-5f4b-4047-ada3-3fce2bc78acd", name: "Kavya", gender: "female", languages: ["en", "hi"] },
      { id: "a81fccdc-5595-4dfc-ae76-4de6a515b8a2", name: "Meera", gender: "female", languages: ["en", "hi"] },
      { id: "4cd9f881-58f7-4969-876a-00983214c362", name: "Varun", gender: "male", languages: ["en", "hi"] },
      { id: "9c35520a-73f9-4c9e-b6c6-69027a3819bd", name: "Poulomi", gender: "female", languages: ["bn"] },
      { id: "cd983593-81f5-4b9d-abad-21791ee86363", name: "Arindam", gender: "male", languages: ["bn"] },
      { id: "dec57575-274e-4544-b4c5-9058bb26b152", name: "Kanmani", gender: "female", languages: ["ta"] },
      { id: "a2f3e72f-7fa0-4e96-91b0-c409115c1c28", name: "Dinesh", gender: "male", languages: ["ta"] },
      { id: "292708e4-1200-4214-a3b7-f522a88c7284", name: "Divya", gender: "female", languages: ["te"] },
      { id: "82c2afc8-ebbc-4802-8ccf-036dc0fa1e3b", name: "Charan", gender: "male", languages: ["te"] },
      { id: "fc0401bc-6eb0-4468-946c-fea5594522b4", name: "Sayali", gender: "female", languages: ["mr"] },
      { id: "e3ca7d7c-d6b2-4dd9-a858-3ea17744a736", name: "Yash", gender: "male", languages: ["mr"] },
      { id: "414a9c07-766e-4eab-87b2-805d424516e8", name: "Chaitra", gender: "female", languages: ["kn"] },
      { id: "3fffe34e-bcfb-4b71-ba11-ff3aba4d6c6f", name: "Chetan", gender: "male", languages: ["kn"] },
      { id: "5ef8514d-954b-4f57-a8c8-c211c0dba93a", name: "Niyati", gender: "female", languages: ["gu"] },
      { id: "91925fe5-42ee-4ebe-96c1-c84b12a85a32", name: "Amit", gender: "male", languages: ["gu"] },
      { id: "b426013c-002b-4e89-8874-8cd20b68373a", name: "Latha", gender: "female", languages: ["ml"] },
      { id: "374b80da-e622-4dfc-90f6-1eeb13d331c9", name: "Vijay", gender: "male", languages: ["ml"] },
      { id: "9bf2ddcd-bb35-4e90-81b3-21c8183b24f4", name: "Navjot", gender: "female", languages: ["pa"] },
      { id: "cf7254bf-2649-41d2-a8b8-23348e824408", name: "Veer", gender: "male", languages: ["pa"] },
    ],
  },
  {
    id: "sarvam",
    label: "Sarvam",
    configured: true,
    models: [
      { id: "bulbul:v3", label: "Bulbul v3", note: "Best for Indian languages" },
    ],
    // bulbul:v3 speakers as listed by Sarvam's API, each TTS-tested (Hindi) on 2026-11-20.
    // Sarvam does not publish speaker genders, so none are shown. bulbul:v2 is deprecated by Sarvam.
    voices: sarvamSpeakers.map((id) => ({ id, name: id[0].toUpperCase() + id.slice(1), languages: sarvamLanguages })),
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
