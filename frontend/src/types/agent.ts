import type { CallStatus } from "@/config/calls";
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
  languageSwitchMode: "auto" | "requested" | "never";

  // Calling
  calling: {
    telephonyProvider: string;
    ambientNoise: string;
    noiseCancellation: boolean;
    voicemailDetection: boolean;
    voicemailSeconds: number;
    dtmf: boolean;
    inbound: { enabled: boolean; number: string };
    /** Outbound calls only inside these hours (UI only until campaigns exist). */
    callingHours: { enabled: boolean; start: string; end: string; days: string[]; timezone: string };
  };

  // Engine
  engine: {
    linearDelayMs: number;
    wordsBeforeInterrupt: number;
    userOnline: { enabled: boolean; afterSeconds: number; message: Localized };
    finalMessage: Localized;
    finalMessageInterruptible: boolean;
    hangupOnSilence: { enabled: boolean; seconds: number };
    callTimeoutSeconds: number;
  };

  tools: ToolConfig[];

  // Post-call
  webhook: { url: string; headersEnabled: boolean; headers: { key: string; value: string }[]; statuses: CallStatus[] };
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
  agent_prompts: Record<string, Record<string, string>>;
}
