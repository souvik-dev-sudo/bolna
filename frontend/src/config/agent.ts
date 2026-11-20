import type { AgentForm, LanguageSettings } from "@/types/agent";

/** Ranges for every slider in the agent editor. */
export const limits = {
  welcomeDelayMs: { min: 0, max: 5000, step: 100 },
  maxTokens: { min: 50, max: 1000, step: 10 },
  temperature: { min: 0, max: 1, step: 0.05 },
  linearDelayMs: { min: 0, max: 1500, step: 50 },
  wordsBeforeInterrupt: { min: 0, max: 10, step: 1 },
  userOnlineAfterSeconds: { min: 3, max: 60, step: 1 },
  hangupOnSilenceSeconds: { min: 5, max: 120, step: 1 },
  callTimeoutSeconds: { min: 60, max: 1800, step: 30 },
  voicemailSeconds: { min: 5, max: 60, step: 1 },
} as const;

/** Rough token count for the prompt editor (~4 characters per token). */
export const CHARS_PER_TOKEN = 4;

export const defaultHangupPrompt = `You are an AI assistant determining if a conversation is complete. A conversation is complete if:

1. The user explicitly says they want to stop (e.g., "That's all", "I'm done", "Goodbye", "thank you").
2. The user seems satisfied, and their goal appears to be achieved.
3. The user's goal appears achieved based on the conversation history, even without explicit confirmation.

If none of these apply, the conversation is not complete.`;

export function defaultLanguageSettings(code: string): LanguageSettings {
  const indic = code !== "en";
  return {
    code,
    voice: indic
      ? { provider: "sarvam", model: "bulbul:v3", voiceId: "ritu" }
      : { provider: "cartesia", model: "sonic-3", voiceId: "ce45ddca-5f4b-4047-ada3-3fce2bc78acd" }, // Kavya (Indian English)
    // Sarvam for every language: Gemini speech-to-text needs Vertex (Google Cloud) credentials,
    // which only the VM has, so a Gemini default breaks new agents on local runs.
    transcriber: { provider: "sarvam", model: "saaras:v3", keywords: "", context: "" },
    handIn: { agentName: "", message: "" },
  };
}

export function newAgentForm(kind: AgentForm["kind"] = "simple", name = "Untitled agent"): AgentForm {
  const now = new Date().toISOString();
  return {
    id: "",
    name,
    kind,
    createdAt: now,
    updatedAt: now,
    welcomeMessage: { en: "Hello! How can I help you today?" },
    welcomeDelayMs: 0,
    ignoreSpeechBeforeWelcome: true,
    prompts: { en: "" },
    hangupPrompt: { enabled: true, prompt: defaultHangupPrompt },
    llm: { provider: "openai", model: "gpt-4.1-mini", maxTokens: 250, temperature: 0.3 },
    knowledgeBaseIds: [],
    defaultLanguage: "en",
    languages: [defaultLanguageSettings("en")],
    languageSwitchMode: "auto",
    calling: {
      telephonyProvider: "plivo",
      voicemailDetection: false,
      voicemailSeconds: 30,
      dtmf: false,
    },
    engine: {
      linearDelayMs: 200,
      wordsBeforeInterrupt: 3,
      userOnline: { enabled: true, afterSeconds: 10, message: { en: "Hello, are you still on the line?" } },
      finalMessage: { en: "" },
      finalMessageInterruptible: false,
      hangupOnSilence: { enabled: true, seconds: 15 },
      callTimeoutSeconds: 420,
    },
    tools: [],
    webhook: { url: "", headersEnabled: false, headers: [] },
    extractions: { summary: true, categories: [] },
    graph:
      kind === "graph"
        ? {
            startNodeId: "Start",
            routingProvider: "openai",
            routingModel: "gpt-4.1-mini",
            routingInstructions: "",
            agentInformation: "",
            nodes: [
              {
                id: "Start",
                type: "router",
                prompt: "",
                staticMessage: {},
                examples: {},
                edges: [{ id: "Start->Greet-0", to: "Greet", condition: "", label: "", unconditional: true }],
              },
              { id: "Greet", type: "llm", prompt: "Greet the caller and ask how you can help.", staticMessage: {}, examples: {}, edges: [] },
            ],
          }
        : undefined,
  };
}

/** Starting points offered in "Create agent". */
export const agentTemplates = [
  {
    id: "blank",
    kind: "simple" as const,
    name: "Blank agent",
    description: "Start from scratch with a single prompt.",
  },
  {
    id: "counsellor",
    kind: "simple" as const,
    name: "Hospital counsellor",
    description: "Warm, patient counselling calls in Hindi.",
  },
  {
    id: "blank-graph",
    kind: "graph" as const,
    name: "Blank graph agent",
    description: "Design a call as a flow of steps.",
  },
  {
    id: "no-show",
    kind: "graph" as const,
    name: "No-show follow-up",
    description: "Multilingual missed-appointment recovery (English, Hindi, Tamil).",
  },
];
