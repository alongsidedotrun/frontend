/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./*.html"],
  theme: {
    extend: {
      colors: {
        "porch-bg": "#20201F",
        "porch-card": "#131313",
        "porch-border": "#27272A",
        "porch-text": "#F1EFE8",
        "porch-muted": "#A1A1AA",
        "porch-btn": "#333333",
        "porch-btn-hover": "#444444",
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "sans-serif"],
        geist: ["Geist", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
      },
    },
  },
  plugins: [],
};
