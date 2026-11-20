// Sample agents for designing the UI. Three are our real agent JSONs (src/mocks/fixtures), so the
// screens render real Bolna configs through the same mapper the backend integration will use.
import { defaultLanguageSettings, newAgentForm } from "@/config/agent";
import { fromBolna, toBolna } from "@/lib/agentMapper";
import type { AgentForm, BolnaAgentPayload } from "@/types/agent";
import counsellor from "./fixtures/hospital-counsellor.json";
import noShowV3 from "./fixtures/no-show-v3.json";
import noShowV4 from "./fixtures/no-show-v4.json";

const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();

function postOpAgent(): BolnaAgentPayload {
  const form = newAgentForm("simple", "Post-op Care Check (Tamil)");
  form.defaultLanguage = "ta";
  form.languages = [defaultLanguageSettings("ta"), defaultLanguageSettings("en")];
  form.languages[0].voice = { provider: "sarvam", model: "bulbul:v3", voiceId: "vidya" };
  form.welcomeMessage = {
    ta: "வணக்கம், நான் Dr. Agarwal's Eye Hospital-ல இருந்து Meera பேசறேன். உங்க surgery-க்கு அப்புறம் எப்படி இருக்கீங்க?",
    en: "Hello, this is Meera from Dr. Agarwal's Eye Hospital. How are you feeling after your surgery?",
  };
  form.prompts = {
    ta: "You are Meera, a post-operative care nurse assistant. Call patients 1, 7 and 30 days after cataract surgery. Ask about pain, redness, blurred vision and eye-drop adherence. If the patient reports severe pain, sudden vision loss or discharge, transfer to the on-call nurse immediately.",
  };
  form.engine.userOnline.message = { ta: "Hello, line-ல இருக்கீங்களா?", en: "Hello, are you still on the line?" };
  form.tools = [
    {
      id: "transfer-nurse",
      kind: "transfer_call",
      name: "transfer_call_on_call_nurse",
      description: "Transfer to the on-call nurse for red-flag symptoms",
      transferNumber: "+914466778899",
    },
  ];
  form.extractions = {
    summary: true,
    categories: [
      { id: "c1", name: "pain_level", description: "Pain on a 0-10 scale as reported by the patient" },
      { id: "c2", name: "red_flag", description: "yes if severe pain, sudden vision loss or discharge was mentioned" },
      { id: "c3", name: "drops_adherence", description: "Whether the patient is using eye drops as prescribed" },
    ],
  };
  return toBolna(form);
}

function reminderAgent(): BolnaAgentPayload {
  const form = newAgentForm("simple", "Appointment Reminder (Bangla)");
  form.defaultLanguage = "bn";
  form.languages = [defaultLanguageSettings("bn"), defaultLanguageSettings("en"), defaultLanguageSettings("hi")];
  form.welcomeMessage = {
    bn: "নমস্কার, আমি Dr. Agarwal's Eye Hospital থেকে প্রিয়া বলছি।",
    en: "Good morning. I am Priya from Dr. Agarwal's Eye Hospital. Preferred language – English, Hindi or Bangla?",
  };
  form.prompts = {
    bn: "You are Priya. Remind {{name}} about their appointment with {{doctor}} at the {{branch}} branch on {{date}} at {{time}}. Confirm whether they will attend; if not, offer to reschedule.",
  };
  form.welcomeDelayMs = 1000;
  return toBolna(form);
}

const seeds: { id: string; payload: BolnaAgentPayload; createdDaysAgo: number; updatedDaysAgo: number }[] = [
  { id: "9c11a4e2-5b7d-4f0e-9a51-3e0c8d2f6b10", payload: noShowV4 as BolnaAgentPayload, createdDaysAgo: 64, updatedDaysAgo: 21 },
  { id: "4b2e9d71-0c3a-4e85-b6f2-8a7d1c90e3f4", payload: noShowV3 as BolnaAgentPayload, createdDaysAgo: 80, updatedDaysAgo: 52 },
  { id: "e7f04c3a-91d2-4b6e-8f15-2c9a7b3d5e86", payload: counsellor as BolnaAgentPayload, createdDaysAgo: 40, updatedDaysAgo: 3 },
  { id: "2d8c5f19-7e4b-4a03-9c62-b1f0e8a4d7c5", payload: postOpAgent(), createdDaysAgo: 18, updatedDaysAgo: 1 },
  { id: "a61f3b08-4d9e-4c27-85b1-6e2f0d9c4a73", payload: reminderAgent(), createdDaysAgo: 30, updatedDaysAgo: 9 },
];

/** In-memory "database" the mock services read and write. */
export const agentStore = new Map<string, { form: AgentForm; payload: BolnaAgentPayload }>(
  seeds.map(({ id, payload, createdDaysAgo, updatedDaysAgo }) => [
    id,
    { form: fromBolna(payload, { id, createdAt: daysAgo(createdDaysAgo), updatedAt: daysAgo(updatedDaysAgo) }), payload },
  ]),
);
