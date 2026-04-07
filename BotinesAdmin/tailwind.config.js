/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        botines: {
          DEFAULT: "#16a34a",
          dark:    "#14532d",
          light:   "#bbf7d0",
        },
      },
    },
  },
  plugins: [],
};
