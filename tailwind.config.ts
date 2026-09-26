import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        surface: {
          DEFAULT: "#0B0F19",
          hover: "#111827",
          subtle: "#070A12",
          card: "#0E1424",
          border: "#1E293B",
          active: "#1E2A45",
        },
        bull: {
          DEFAULT: "#10B981",
          glow: "rgba(16, 185, 129, 0.15)",
          text: "#34D399",
          border: "#059669",
        },
        bear: {
          DEFAULT: "#F43F5E",
          glow: "rgba(244, 63, 94, 0.15)",
          text: "#FB7185",
          border: "#E11D48",
        },
        ai: {
          DEFAULT: "#6366F1",
          cyan: "#38BDF8",
          purple: "#A855F7",
          glow: "rgba(99, 102, 241, 0.2)",
        },
        terminal: {
          bg: "#06080F",
          panel: "#0A0E18",
          sidebar: "#070B14",
          border: "#182030",
          highlight: "#1E2638",
        }
      },
      fontFamily: {
        mono: ["var(--font-geist-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        'terminal': '0 4px 20px -2px rgba(0, 0, 0, 0.7)',
        'ai-glow': '0 0 25px -5px rgba(99, 102, 241, 0.3)',
        'bull-glow': '0 0 20px -5px rgba(16, 185, 129, 0.3)',
        'bear-glow': '0 0 20px -5px rgba(244, 63, 94, 0.3)',
      }
    },
  },
  plugins: [],
};
export default config;
