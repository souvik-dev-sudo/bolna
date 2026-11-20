// Rough per-minute prices (USD) used for the "estimated cost per minute" in the agent header and
// the call history totals. Estimates only: there is no billing system. Update as contracts change.

export const pricePerMinute = {
  transcriber: {
    gemini: 0.006,
    sarvam: 0.005,
    deepgram: 0.0077,
    azure: 0.016,
  } as Record<string, number>,
  // LLM cost per minute of conversation, assuming ~1.2k tokens/min.
  llm: {
    "gpt-4.1": 0.022,
    "gpt-4.1-mini": 0.0055,
    "gpt-4o": 0.02,
    "gpt-4o-mini": 0.0025,
    "gemini-2.5-flash": 0.004,
    "gemini-2.5-pro": 0.018,
    "sarvam-m": 0.003,
    "llama-3.3-70b-versatile": 0.004,
  } as Record<string, number>,
  voice: {
    cartesia: 0.03,
    sarvam: 0.012,
    elevenlabs: 0.05,
  } as Record<string, number>,
  telephony: {
    plivo: 0.012,
    twilio: 0.014,
    exotel: 0.01,
    web: 0,
  } as Record<string, number>,
  fallback: 0.01,
} as const;

export const currency = { code: "USD", symbol: "$" } as const;
