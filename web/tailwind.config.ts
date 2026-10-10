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
        background: "var(--background)",
        foreground: "var(--foreground)",
        surface: {
          light: "#F4F7FB",
          card: "#FFFFFF",
          dark: "#14171A",
          darkCard: "#1C2025",
          border: "#E2E8F0",
        },
        vitality: {
          DEFAULT: "#D2F800",
          hover: "#BEE000",
          dim: "rgba(210, 248, 0, 0.15)",
        },
        clinical: {
          cyan: "#0284C7",
          cyanLight: "#E0F2FE",
          cyanDim: "rgba(2, 132, 199, 0.12)",
          emerald: "#10B981",
          emeraldDim: "rgba(16, 185, 129, 0.12)",
          amber: "#F59E0B",
          amberDim: "rgba(245, 158, 11, 0.12)",
          crimson: "#EF4444",
          crimsonDim: "rgba(239, 68, 68, 0.12)",
        },
      },
      borderRadius: {
        "3xl": "1.75rem",
        "4xl": "2.25rem",
      },
      boxShadow: {
        "soft-sm": "0 2px 10px rgba(0, 0, 0, 0.03)",
        "soft-md": "0 8px 30px rgba(0, 0, 0, 0.06)",
        "soft-lg": "0 20px 40px rgba(0, 0, 0, 0.08)",
        "glow-vitality": "0 0 35px rgba(210, 248, 0, 0.35)",
        "glow-cyan": "0 0 35px rgba(2, 132, 199, 0.30)",
      },
    },
  },
  plugins: [],
};
export default config;
