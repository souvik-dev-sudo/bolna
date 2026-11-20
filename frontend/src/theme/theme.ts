/**
 * The single source of truth for the app's look.
 *
 * Brand values come from nexaneura.com (assets/css/styles.css). Tailwind reads `theme.colors`,
 * `theme.radius`, `theme.shadows` and `theme.fonts` (see tailwind.config.ts), so a change here
 * restyles every screen. Code that draws outside Tailwind (charts, the graph canvas) imports the
 * same objects directly.
 *
 * Light theme only, matching the website.
 */

/** Raw brand palette. Prefer the semantic `colors` below in components. */
export const palette = {
  indigo: "#4F46E5",
  indigoDeep: "#3A31C4",
  indigoWash: "#EEF0FE",
  indigoLight: "#A5A0FF",
  indigoBorder: "#C9CDF6",
  navy: "#0A1733",
  body: "#212B47",
  secondary: "#3C4866",
  placeholder: "#8E98BA",
  line: "#DFE4EF",
  lineStrong: "#C3C9EC",
  white: "#FFFFFF",
  alt: "#F4F6FB",
  altDeep: "#EBEEF6",
  green: "#0B8F6C",
  greenDeep: "#086A51",
  greenWash: "#EAF8F2",
  amber: "#B45309",
  amberWash: "#FDF3E7",
  wine: "#9E2F4E",
  wineWash: "#FBEEF1",
  heroBg: "#070D1E",
} as const;

/** Semantic colors used through Tailwind classes (`bg-primary`, `text-muted-foreground`, …). */
export const colors = {
  background: palette.alt, // page canvas
  foreground: palette.body,
  heading: palette.navy,

  surface: { DEFAULT: palette.white, sunken: palette.alt, raised: palette.white },
  card: { DEFAULT: palette.white, foreground: palette.body },
  popover: { DEFAULT: palette.white, foreground: palette.body },

  primary: {
    DEFAULT: palette.indigo,
    hover: palette.indigoDeep,
    foreground: palette.white,
    soft: palette.indigoWash,
    light: palette.indigoLight,
    border: palette.indigoBorder,
  },
  secondary: { DEFAULT: palette.alt, foreground: palette.navy },
  muted: { DEFAULT: palette.alt, deep: palette.altDeep, foreground: palette.secondary },
  placeholder: palette.placeholder,
  accent: { DEFAULT: palette.indigoWash, foreground: palette.indigoDeep },

  border: { DEFAULT: palette.line, strong: palette.lineStrong },
  input: palette.line,
  ring: palette.indigo,

  success: { DEFAULT: palette.green, deep: palette.greenDeep, soft: palette.greenWash, foreground: palette.white },
  warning: { DEFAULT: palette.amber, soft: palette.amberWash, foreground: palette.white },
  danger: { DEFAULT: palette.wine, soft: palette.wineWash, foreground: palette.white },

  hero: palette.heroBg,
} as const;

export const fonts = {
  sans: ['"Space Grotesk"', '"Segoe UI Variable Display"', '"Segoe UI"', '"Helvetica Neue"', "Arial", "sans-serif"],
  // Transcripts and prompts in Indian languages fall back to these.
  indic: ['"Noto Sans Devanagari"', '"Noto Sans Bengali"', '"Noto Sans Tamil"', '"Nirmala UI"', "sans-serif"],
  mono: ["ui-monospace", "SFMono-Regular", '"SF Mono"', "Menlo", "Consolas", "monospace"],
} as const;

export const radius = {
  sm: "8px", // chips, small buttons
  md: "10px", // inputs, buttons
  lg: "14px", // panels
  xl: "16px", // cards (site --r)
  pill: "999px",
} as const;

export const shadows = {
  card: "0 1px 2px rgba(10, 23, 51, .06), 0 12px 32px rgba(10, 23, 51, .09)",
  soft: "0 1px 2px rgba(10, 23, 51, .05), 0 4px 14px rgba(10, 23, 51, .06)",
  lift: "0 4px 10px rgba(10, 23, 51, .08), 0 28px 60px rgba(10, 23, 51, .16)",
  button: "0 1px 2px rgba(58, 49, 196, .28), 0 8px 20px rgba(79, 70, 229, .24)",
  buttonHover: "0 2px 4px rgba(58, 49, 196, .3), 0 14px 30px rgba(79, 70, 229, .3)",
  focus: "0 0 0 3px rgba(79, 70, 229, .18)",
} as const;

/** Decorative gradients from the site. Use sparingly: empty states, hero cards, the brand mark. */
export const gradients = {
  brand:
    "radial-gradient(circle at 26% 20%, #8FD8F2 0%, rgba(143,216,242,0) 46%), radial-gradient(circle at 46% 58%, #37B394 0%, rgba(55,179,148,0) 46%), radial-gradient(circle at 70% 88%, #C226CF 0%, rgba(194,38,207,0) 56%), radial-gradient(circle at 78% 26%, #FBA7D6 0%, rgba(251,167,214,0) 52%), #EEF0FE",
  indigo: "linear-gradient(135deg, #4F46E5 0%, #3A31C4 100%)",
  hero: "radial-gradient(circle at 80% 0%, rgba(79,70,229,.45) 0%, rgba(7,13,30,0) 55%), #070D1E",
} as const;

/**
 * Chart colors. Categorical order is fixed (never cycled) and was validated with the dataviz
 * validator on the white card surface: all checks pass; slot 3 (aqua) is below 3:1 contrast, so
 * any chart using it shows direct labels or values.
 */
export const chart = {
  categorical: ["#4F46E5", "#EB6834", "#1BAF7A", "#C226CF"] as const,
  single: palette.indigo, // one-series charts
  singleSoft: palette.indigoWash,
  grid: palette.line,
  axis: palette.placeholder,
  surface: palette.white,
} as const;

/** Status is never color alone: every status has a label and an icon name (lucide). */
export type Tone = "neutral" | "info" | "success" | "warning" | "danger";

export const tones: Record<Tone, { fg: string; bg: string; border: string }> = {
  neutral: { fg: palette.secondary, bg: palette.alt, border: palette.line },
  info: { fg: palette.indigoDeep, bg: palette.indigoWash, border: palette.indigoBorder },
  success: { fg: palette.greenDeep, bg: palette.greenWash, border: "#A6D6C3" },
  warning: { fg: palette.amber, bg: palette.amberWash, border: "#F2D3B0" },
  danger: { fg: palette.wine, bg: palette.wineWash, border: "#F3D7DE" },
};

/** Graph agent node styling by node type. */
export const graphNodes = {
  router: { label: "Router", accent: palette.secondary, soft: palette.alt, icon: "Split" },
  llm: { label: "LLM", accent: palette.indigo, soft: palette.indigoWash, icon: "Sparkles" },
  static: { label: "Static", accent: palette.green, soft: palette.greenWash, icon: "MessageSquareQuote" },
  end: { label: "End", accent: palette.wine, soft: palette.wineWash, icon: "PhoneOff" },
} as const;

export const graphCanvas = {
  background: palette.alt,
  dots: palette.lineStrong,
  edge: "#A9B1C6",
  edgeActive: palette.indigo,
  edgeLabelBg: palette.white,
} as const;

export const theme = {
  palette,
  colors,
  fonts,
  radius,
  shadows,
  gradients,
  chart,
  tones,
  graphNodes,
  graphCanvas,
} as const;

export default theme;
