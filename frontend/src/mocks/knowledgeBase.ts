import type { KnowledgeBase } from "@/types/knowledgeBase";

const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();

export const knowledgeBaseStore: KnowledgeBase[] = [
  {
    id: "31e2f76a-5864-4f12-aac7-11d45a34dbbd",
    name: "agarwal-availability-demo.pdf",
    type: "pdf",
    sizeBytes: 482_113,
    chunks: 64,
    status: "processed",
    createdAt: daysAgo(31),
    usedByAgents: ["9c11a4e2-5b7d-4f0e-9a51-3e0c8d2f6b10"],
  },
  {
    id: "ac30e2e3-924f-46d4-8d9f-bb796cdeec9b",
    name: "agarwal-faq-demo.pdf",
    type: "pdf",
    sizeBytes: 1_204_560,
    chunks: 142,
    status: "processed",
    createdAt: daysAgo(58),
    usedByAgents: [],
  },
  {
    id: "123a34b8-65de-4c63-a184-01ded4a2de4b",
    name: "agarwal-fees-demo.pdf",
    type: "pdf",
    sizeBytes: 228_902,
    chunks: 27,
    status: "processed",
    createdAt: daysAgo(61),
    usedByAgents: [],
  },
  {
    id: "7f9b0c21-3a64-4e8d-b2f7-5c1d9e0a8b36",
    name: "post-op-care-guidelines.pdf",
    type: "pdf",
    sizeBytes: 932_440,
    status: "processing",
    createdAt: daysAgo(0),
    usedByAgents: [],
  },
];
