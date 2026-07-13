/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        axis: {
          blue: "#1e9bf0",
          yellow: "#ffcf3a",
          pink: "#ff6fa1",
          navy: "#0a1a2f",
        },
      },
      fontFamily: {
        display: ["'Baloo 2'", "'Segoe UI'", "sans-serif"],
      },
    },
  },
  plugins: [],
};
