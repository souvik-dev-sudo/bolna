import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";
import containerQueries from "@tailwindcss/container-queries";
import { colors, fonts, radius, shadows } from "./src/theme/theme";

// Every color, radius, shadow and font comes from src/theme/theme.ts. Change it there.
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: "1.5rem", screens: { "2xl": "1400px" } },
    extend: {
      colors,
      fontFamily: { sans: [...fonts.sans], indic: [...fonts.indic], mono: [...fonts.mono] },
      borderRadius: { sm: radius.sm, md: radius.md, lg: radius.lg, xl: radius.xl, pill: radius.pill },
      boxShadow: {
        card: shadows.card,
        soft: shadows.soft,
        lift: shadows.lift,
        button: shadows.button,
        "button-hover": shadows.buttonHover,
        focus: shadows.focus,
      },
      letterSpacing: { brand: "-0.032em", tightish: "-0.015em" },
      keyframes: {
        "pulse-ring": {
          "0%": { transform: "scale(0.9)", opacity: "0.7" },
          "100%": { transform: "scale(1.6)", opacity: "0" },
        },
        "wave-bar": {
          "0%, 100%": { transform: "scaleY(0.35)" },
          "50%": { transform: "scaleY(1)" },
        },
      },
      animation: {
        "pulse-ring": "pulse-ring 1.6s cubic-bezier(0.2, 0.6, 0.4, 1) infinite",
        "wave-bar": "wave-bar 1s ease-in-out infinite",
      },
    },
  },
  plugins: [animate, containerQueries],
} satisfies Config;
