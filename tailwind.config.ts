import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        rudo: {
          bg: "#080a0e",
          surface: "#0c0e14",
          "surface-2": "#10131a",
          blue: "#38bdf8",
          "blue-soft": "rgba(56, 189, 248, 0.1)",
          "blue-glow": "rgba(56, 189, 248, 0.25)",
          "blue-mid": "rgba(56, 189, 248, 0.5)",
          "blue-ghost": "rgba(56, 189, 248, 0.06)",
          rose: "#c4285a",
          "rose-glow": "rgba(196, 40, 90, 0.3)",
          "rose-soft": "rgba(196, 40, 90, 0.1)",
          text: "#e4eef5",
          "text-sec": "rgba(228, 238, 245, 0.5)",
          muted: "rgba(255, 255, 255, 0.25)",
          border: "rgba(56, 189, 248, 0.08)",
          "border-hover": "rgba(56, 189, 248, 0.18)",
        },
      },
      fontFamily: {
        outfit: ["Outfit", "sans-serif"],
        instrument: ["Instrument Serif", "serif"],
        orbitron: ["Orbitron", "sans-serif"],
        mono: ["SF Mono", "Fira Code", "monospace"],
      },
      animation: {
        "pulse-dot": "pulse-dot 2s ease-in-out infinite",
        float: "float 8s ease-in-out infinite",
        "float-reverse": "float 10s ease-in-out infinite reverse",
        "fade-in": "fade-in 0.8s ease-out forwards",
        "glitch-1": "glitch-1 4s infinite",
        "glitch-2": "glitch-2 4s infinite",
      },
      keyframes: {
        "pulse-dot": {
          "0%, 100%": {
            opacity: "1",
            boxShadow: "0 0 0 0 rgba(56, 189, 248, 0.25)",
          },
          "50%": {
            opacity: "0.4",
            boxShadow: "0 0 14px 5px rgba(56, 189, 248, 0.25)",
          },
        },
        float: {
          "0%, 100%": { transform: "translateY(0) scale(1)" },
          "50%": { transform: "translateY(-25px) scale(1.04)" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(24px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "glitch-1": {
          "0%, 94%, 100%": {
            clipPath: "inset(0 0 0 0)",
            transform: "translate(0)",
          },
          "95%": {
            clipPath: "inset(25% 0 55% 0)",
            transform: "translate(-3px, 1px)",
          },
          "97%": {
            clipPath: "inset(65% 0 10% 0)",
            transform: "translate(3px, -1px)",
          },
        },
        "glitch-2": {
          "0%, 94%, 100%": {
            clipPath: "inset(0 0 0 0)",
            transform: "translate(0)",
          },
          "96%": {
            clipPath: "inset(45% 0 25% 0)",
            transform: "translate(3px, -2px)",
          },
          "98%": {
            clipPath: "inset(10% 0 70% 0)",
            transform: "translate(-3px, 1px)",
          },
        },
      },
    },
  },
  plugins: [],
};

export default config;
