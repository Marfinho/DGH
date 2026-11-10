import type { Config } from "tailwindcss";

// Design „Plakat“: Logo-Farben Grün / Rot / Gelb, kräftige Rahmen, Condensed-Überschriften
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { 50: "#E8F3EC", 100: "#D3E8DA", 600: "#0B4F2A", 700: "#083D20" },
        poster: { DEFAULT: "#BA1722", dark: "#8F1019", light: "#FCEBEC" },
        sun: { DEFAULT: "#FFCA01", light: "#FFF1B8" },
        ink: "#14281B",
        // grünstichiges Grau: bestehende stone-*-Klassen übernehmen damit automatisch das Design
        stone: { 50: "#F4F8F5", 100: "#E8F0EA", 200: "#D9E6DD", 300: "#B7CBBE", 400: "#8AA394", 500: "#5C6F62", 600: "#3F5546", 700: "#2B3F32", 800: "#1B2E22", 900: "#14281B" },
      },
      fontFamily: {
        sans: ["Barlow", "system-ui", "sans-serif"],
        display: ['"Barlow Condensed"', "Barlow", "system-ui", "sans-serif"],
        script: ['"Kaushan Script"', "cursive"],
      },
      boxShadow: { hard: "5px 5px 0 #0B4F2A", "hard-sm": "3px 3px 0 #0B4F2A" },
    },
  },
  plugins: [],
} satisfies Config;
