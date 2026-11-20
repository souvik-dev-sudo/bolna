// Generated, deterministic call history for designing Call History and Overview.
import type { CallStatus, CallType, HangupBy } from "@/config/calls";
import type { CallRecord, TranscriptTurn, TurnLatency } from "@/types/call";
import { agentStore } from "./agents";

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20261120);
const pick = <T,>(items: readonly T[]) => items[Math.floor(rand() * items.length)];
const between = (min: number, max: number) => Math.round(min + rand() * (max - min));
const weighted = <T,>(entries: [T, number][]) => {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [value, weight] of entries) {
    if ((r -= weight) <= 0) return value;
  }
  return entries[0][0];
};
const uuid = () =>
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.floor(rand() * 16);
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });

const conversations: Record<string, Omit<TranscriptTurn, "at">[]> = {
  noShow: [
    { role: "agent", text: "Good morning. I am Kavya from Dr. Agarwal's Eye Hospital. Preferred language - English, Hindi or Tamil?", language: "en", node: "Start" },
    { role: "user", text: "Tamil please.", language: "en" },
    { role: "agent", text: "சரி, தமிழ்ல பேசலாம். Rahul Sir, 22 September Anna nagar branch-ல உங்க appointment miss ஆயிடுச்சு.", language: "ta", node: "Notify" },
    { role: "user", text: "ஆமா, அன்னைக்கு office-ல வேலை இருந்துச்சு.", language: "ta" },
    { role: "agent", text: "பரவாயில்லை. இந்த வாரம் எந்த நாள் உங்களுக்கு வசதி?", language: "ta", node: "Reason" },
    { role: "user", text: "Saturday morning வரலாமா?", language: "ta" },
    { role: "agent", text: "Saturday காலை 10:30-க்கு Doctor Amod Nayak கிட்ட slot இருக்கு. Book பண்ணட்டுமா?", language: "ta", node: "Reschedule_Date_Time" },
    { role: "user", text: "சரி, பண்ணுங்க.", language: "ta" },
    { role: "agent", text: "Booked. உங்க பேர் மற்றும் வயசு confirm பண்ணுங்க.", language: "ta", node: "Patient_Name_Age" },
    { role: "user", text: "Rahul, 46.", language: "ta" },
    { role: "agent", text: "நன்றி Rahul Sir. Saturday பார்க்கலாம்!", language: "ta", node: "Patient_Name_Age" },
  ],
  counsellor: [
    { role: "agent", text: "नमस्ते, मैं सिटी हॉस्पिटल की काउंसलिंग टीम से स्नेहा बोल रही हूँ। क्या अभी बात करने का सही समय है?", language: "hi" },
    { role: "user", text: "हाँ, बोलिए।", language: "hi" },
    { role: "agent", text: "आपके पिताजी की मोतियाबिंद सर्जरी के बारे में कुछ सवाल थे। क्या आप उनके साथ अस्पताल आएँगे?", language: "hi" },
    { role: "user", text: "हाँ, लेकिन खर्चे को लेकर थोड़ी चिंता है।", language: "hi" },
    { role: "agent", text: "समझ सकती हूँ। आयुष्मान भारत कार्ड से यह सर्जरी कवर हो सकती है। क्या आपके पास कार्ड है?", language: "hi" },
    { role: "user", text: "हाँ, है।", language: "hi" },
    { role: "agent", text: "बहुत बढ़िया। फिर आपको लगभग कुछ भी नहीं देना होगा। मैं आपके लिए गुरुवार की काउंसलिंग बुक कर देती हूँ।", language: "hi" },
    { role: "user", text: "ठीक है, धन्यवाद।", language: "hi" },
  ],
  postOp: [
    { role: "agent", text: "Hello, this is Meera from Dr. Agarwal's Eye Hospital. How are you feeling after your surgery?", language: "en" },
    { role: "user", text: "Better, but there's some itching.", language: "en" },
    { role: "agent", text: "Mild itching is common in the first week. Any pain, redness, or blurry vision?", language: "en" },
    { role: "user", text: "No pain. Vision is getting clearer.", language: "en" },
    { role: "agent", text: "That's great. Are you using the eye drops four times a day?", language: "en" },
    { role: "user", text: "Yes, I am.", language: "en" },
    { role: "agent", text: "Perfect. Please avoid rubbing the eye. Your follow-up is next Tuesday. Take care!", language: "en" },
  ],
};

const summaries: Record<string, string> = {
  noShow: "Patient missed the 22 Sep appointment due to work. Rescheduled to Saturday 10:30 AM with Dr. Amod Nayak, Anna Nagar.",
  counsellor: "Caller is the patient's son, concerned about cost. Confirmed Ayushman Bharat card; counselling booked for Thursday.",
  postOp: "Day-7 check: mild itching, no pain or redness, vision improving, drops used as prescribed. No red flags.",
};

function themeFor(agentName: string) {
  if (/no.?show/i.test(agentName)) return "noShow";
  if (/counsel/i.test(agentName)) return "counsellor";
  return "postOp";
}

function buildTranscript(theme: string, durationSeconds: number, completed: boolean): TranscriptTurn[] {
  const turns = conversations[theme];
  const used = completed ? turns : turns.slice(0, between(1, 3));
  const step = durationSeconds / Math.max(used.length, 1);
  return used.map((t, i) => ({ ...t, at: Math.round(i * step + rand() * 2) }));
}

function buildLatencies(turns: number): TurnLatency[] {
  return Array.from({ length: turns }, (_, i) => {
    const transcriberMs = between(160, 360);
    const llmMs = between(320, 880);
    const synthesizerMs = between(110, 280);
    return { turn: i + 1, transcriberMs, llmMs, synthesizerMs, totalMs: transcriberMs + llmMs + synthesizerMs };
  });
}

function generate(): CallRecord[] {
  const agents = [...agentStore.values()].map((a) => a.form);
  const calls: CallRecord[] = [];
  const now = Date.now();

  for (let i = 0; i < 156; i++) {
    const agent = pick(agents);
    const daysBack = Math.floor(Math.pow(rand(), 1.4) * 30);
    const started = new Date(now - daysBack * 86_400_000 - between(0, 9 * 3600) * 1000 - 3600_000);
    started.setHours(between(9, 19), between(0, 59), between(0, 59));
    // Calls placed "today" must not land later than now.
    if (started.getTime() > now - 5 * 60_000) started.setTime(now - between(5, 240) * 60_000);
    const type: CallType = weighted<CallType>([["outbound", 78], ["web", 15], ["inbound", 7]]);
    const status: CallStatus =
      i < 2
        ? i === 0 ? "in-progress" : "queued"
        : weighted<CallStatus>([["completed", 70], ["no-answer", 13], ["busy", 5], ["failed", 4], ["canceled", 2]]);
    const completed = status === "completed";
    const durationSeconds = completed ? between(38, 280) : status === "in-progress" ? between(20, 90) : 0;
    const theme = themeFor(agent.name);
    const transcript = completed || status === "in-progress" ? buildTranscript(theme, durationSeconds, completed) : [];
    const agentTurns = transcript.filter((t) => t.role === "agent").length;

    const hangupBy: HangupBy | undefined = completed ? weighted<HangupBy>([["agent", 62], ["user", 30], ["system", 8]]) : undefined;
    const terminationReason = completed
      ? hangupBy === "agent"
        ? pick(["llm_prompted_hangup", "llm_prompted_hangup", "transferred"])
        : hangupBy === "user"
          ? "user_hangup"
          : pick(["silence_timeout", "call_timeout", "voicemail_detected"])
      : status === "no-answer"
        ? "no_answer"
        : status === "busy"
          ? "busy"
          : status === "failed"
            ? "error"
            : undefined;

    const provider = type === "web" ? "web" : "plivo";
    const rate = type === "web" ? 0.058 : 0.07;
    calls.push({
      id: uuid(),
      callSid: type === "web" ? undefined : uuid(),
      agentId: agent.id,
      agentName: agent.name,
      type,
      status,
      userNumber: type === "web" ? "Browser" : `+91 9${between(100000000, 999999999)}`,
      fromNumber: type === "web" ? undefined : "+91 80 4718 2290",
      provider,
      startedAt: started.toISOString(),
      durationSeconds,
      hangupBy,
      terminationReason,
      costUsd: Number(((durationSeconds / 60) * rate).toFixed(4)),
      recordingUrl: completed && type !== "web" ? `#recording-${i}` : undefined,
      transcript,
      latencies: buildLatencies(agentTurns),
      summary: completed ? summaries[theme] : undefined,
      extracted:
        completed && theme === "postOp"
          ? { pain_level: String(between(0, 3)), red_flag: "no", drops_adherence: "yes" }
          : completed && theme === "noShow"
            ? { rescheduled: "yes", new_slot: "Sat 10:30 AM", reason: "work" }
            : undefined,
      rating: completed && rand() > 0.6 ? between(3, 5) : undefined,
      languages: [...new Set(transcript.map((t) => t.language).filter(Boolean) as string[])],
    });
  }
  return calls.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export const callStore: CallRecord[] = generate();
