export type KnowledgeBaseStatus = "processing" | "processed" | "failed";

export interface KnowledgeBase {
  id: string; // RAG / collection ID
  name: string; // source file name or URL
  type: "pdf" | "url" | "text";
  sizeBytes?: number;
  chunks?: number;
  status: KnowledgeBaseStatus;
  createdAt: string;
  usedByAgents: string[];
}
