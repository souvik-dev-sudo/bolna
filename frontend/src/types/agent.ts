import type { ToolKind } from "@/config/tools";

/** A per-language text, e.g. { en: "Hello", hi: "नमस्ते" }. */
export type Localized = Record<string, string>;

export type AgentKind = "simple" | "graph";

export interface LanguageSettings {
  code: string;
  voice: { provider: string; model: string; voiceId: string };
  transcriber: { provider: string; model: string; keywords: string; context: string };
  handIn: { agentName: string; message: string };
}

export interface ToolConfig {
  id: string;
  kind: ToolKind;
  name: string; // function name the LLM sees
  description: string;
  /** transfer_call */
  transferNumber?: string;
  /** custom */
  method?: string;
  url?: string;
  parameters?: { name: string; type: "string" | "number" | "boolean"; description: string; required: boolean }[];
  headers?: { key: string; value: string }[];
  /** Graph agents: node IDs where the tool may be called; empty = everywhere. */
  nodes?: string[];
}

export interface ExtractionCategory {
  id: string;
  name: string;
  description: string;
}

export interface GraphEdge {
  id: string;
  to: string;
  condition: string;
  label: string;
  functionName?: string;
  unconditional: boolean;
}

export type GraphNodeType = "router" | "llm" | "static";

export interface GraphNode {
  id: string;
  type: GraphNodeType;
  prompt: string;
  staticMessage: Localized;
  examples: Localized;
  edges: GraphEdge[];
  position?: { x: number; y: number };
}

export interface GraphDefinition {
  startNodeId: string;
  routingProvider: string;
  routingModel: string;
  routingInstructions: string;
  agentInformation: string;
  nodes: GraphNode[];
}

/** The editor's model of an agent. Mapped to/from Bolna's agent JSON in lib/agentMapper.ts. */
export interface AgentForm {
  id: string;
  name: string;
  kind: AgentKind;
  createdAt: string;
  updatedAt: string;

  // Prompt
  welcomeMessage: Localized;
  welcomeDelayMs: number;
  ignoreSpeechBeforeWelcome: boolean;
  prompts: Localized; // system prompt per language (default language first)
  hangupPrompt: { enabled: boolean; prompt: string };

  // Intelligence
  llm: { provider: string; model: string; maxTokens: number; temperature: number };
  knowledgeBaseIds: string[];

  // Languages
  defaultLanguage: string;
  languages: LanguageSettings[];
  /** "auto": the default language listens in Sarvam auto-detect, so any language reaches the LLM;
   *  "requested": fixed language, switch only through the switch_language tool. */
  languageSwitchMode: "auto" | "requested";

  // Calling
  calling: {
    telephonyProvider: string;
    voicemailDetection: boolean;
    voicemailSeconds: number;
    dtmf: boolean;
  };

  // Engine
  engine: {
    linearDelayMs: number;
    wordsBeforeInterrupt: number;
    userOnline: { enabled: boolean; afterSeconds: number; message: Localized };
    finalMessage: Localized;
    finalMessageInterruptible: boolean;
    /** Off is stored as hangup_after_silence: 0 (the engine skips the check at 0). */
    hangupOnSilence: { enabled: boolean; seconds: number };
    callTimeoutSeconds: number;
  };

  tools: ToolConfig[];

  // Post-call
  /** agent_config.webhook_url / webhook_headers; bolna-app POSTs the call result after every call. */
  webhook: { url: string; headersEnabled: boolean; headers: { key: string; value: string }[] };
  /** Follow-up tasks: summarization, and extraction with {name: description} as its schema. */
  extractions: { summary: boolean; categories: ExtractionCategory[] };

  graph?: GraphDefinition;
}

/** A row in the agent lists. */
export interface AgentSummary {
  id: string;
  name: string;
  kind: AgentKind;
  languages: string[];
  llmModel: string;
  voiceProvider: string;
  transcriberProvider: string;
  updatedAt: string;
  nodeCount?: number;
}

/** Bolna's stored shape: POST /agent body. Typed loosely; agentMapper is the only reader. */
export interface BolnaAgentPayload {
  agent_config: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  /** {task_1: {system_prompt: "...", multilingual_prompts?: {lang: "..."}}} */
  agent_prompts: Record<string, Record<string, string | Record<string, string>>>;
}
