/**
 * Knowledge base service. Mock only.
 *
 * Backend integration is blocked (tracker §5): Bolna's RAG server is not open source. Once we build
 * our own (PDF -> embeddings -> pgvector), these map to /api/bolna/knowledge-bases.
 */
import { knowledgeBaseStore } from "@/mocks/knowledgeBase";
import type { KnowledgeBase } from "@/types/knowledgeBase";
import { delay, newId } from "./mock";

export async function listKnowledgeBases(): Promise<KnowledgeBase[]> {
  await delay();
  return [...knowledgeBaseStore].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function uploadKnowledgeBase(file: File): Promise<KnowledgeBase> {
  await delay(800);
  const kb: KnowledgeBase = {
    id: newId(),
    name: file.name,
    type: file.name.toLowerCase().endsWith(".pdf") ? "pdf" : "text",
    sizeBytes: file.size,
    status: "processing",
    createdAt: new Date().toISOString(),
    usedByAgents: [],
  };
  knowledgeBaseStore.unshift(kb);
  // Pretend the server finishes processing a few seconds later.
  setTimeout(() => {
    kb.status = "processed";
    kb.chunks = Math.max(8, Math.round(file.size / 6000));
  }, 4000);
  return kb;
}

export async function addUrlKnowledgeBase(url: string): Promise<KnowledgeBase> {
  await delay(600);
  const kb: KnowledgeBase = {
    id: newId(),
    name: url,
    type: "url",
    status: "processing",
    createdAt: new Date().toISOString(),
    usedByAgents: [],
  };
  knowledgeBaseStore.unshift(kb);
  setTimeout(() => {
    kb.status = "processed";
    kb.chunks = 36;
  }, 4000);
  return kb;
}

export async function deleteKnowledgeBase(id: string): Promise<void> {
  await delay();
  const i = knowledgeBaseStore.findIndex((k) => k.id === id);
  if (i >= 0) knowledgeBaseStore.splice(i, 1);
}
