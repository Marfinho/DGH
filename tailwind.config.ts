import type { Config } from "tailwindcss";
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: { extend: { colors: { brand: { 50: "#f0f7f1", 100: "#dcebde", 600: "#2f6b3f", 700: "#25552f" } } } },
  plugins: [],
} satisfies Config;
