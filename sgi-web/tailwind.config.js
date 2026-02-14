/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        layoutBg: "#f4f6f9",
        sidebarBg: "#1e293b",
        primaryBlue: "#2563eb",
        textDark: "#1e293b",
        textLight: "#6b7280"
      },
      boxShadow: {
        card: "0 8px 24px rgba(0,0,0,0.06)"
      }
    }
  },
  plugins: []
};
