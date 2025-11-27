module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: { 500: '#8b5cf6', 600: '#7c3aed' },
        dark: { 800: '#1f2937', 900: '#111827', 950: '#0a0a0a' },
        success: '#10b981',
      },
    },
  },
  plugins: [],
};
