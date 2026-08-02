/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./*.html"],
  theme: {
    extend: {
      colors: {
        // Each token resolves through a CSS custom property (defined in
        // input.css) rather than a fixed hex, so a data-theme attribute swap
        // on <html> can retarget every one of these at once, with a
        // transition (also in input.css) animating the change.
        "porch-bg": "var(--porch-bg)",
        "porch-card": "var(--porch-card)",
        "porch-input": "var(--porch-input)",
        "porch-border": "var(--porch-border)",
        "porch-text": "var(--porch-text)",
        "porch-muted": "var(--porch-muted)",
        "porch-btn": "var(--porch-btn)",
        "porch-btn-hover": "var(--porch-btn-hover)",
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "sans-serif"],
        geist: ["Geist", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
      },
    },
  },
  plugins: [],
};
