/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1c1814",
        "ink-soft": "#6b6057",
        paper: "#E5E0D6",
        cream: "#E5E0D6",
        red: "#95261E",
        "blue-margin": "#b8c4d4",
        pen: "#28356F",
        rule: "#ddd8ce",
        "rule-strong": "#c8c2b4",
        surface: "#e8e2d9",
      },
      fontFamily: {
        body: ['"Source Serif 4"', "Georgia", "serif"],
        display: ['"Helvetica Neue"', "Helvetica", "Arial", "sans-serif"],
        hand: ['"Patrick Hand"', "cursive"],
        mono: ['"IBM Plex Mono"', "monospace"],
        script: ['"Caveat"', "cursive"],
      },
      spacing: {
        line: "1.75rem",
        "line-2": "3.5rem",
        "line-4": "7rem",
        margin: "3.5rem",
      },
      lineHeight: {
        rule: "1.75rem",
      },
      maxWidth: {
        page: "720px",
      },
      fontSize: {
        "2xs": "0.5rem",
        "3xs": "0.6rem",
      },
    },
  },
  plugins: [],
};
