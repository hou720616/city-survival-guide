/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: "1.5rem",
        sm: "2rem",
        lg: "4rem",
        xl: "5rem",
      },
    },
    extend: {
      colors: {
        // Hearthlight Cartography 色板
        terracotta: {
          DEFAULT: "#C75B3A",
          light: "#E07A52",
          dark: "#A04828",
          50: "#FBF0EB",
          100: "#F5DDD2",
          200: "#EBBBA6",
          300: "#E0997A",
          400: "#D67A55",
          500: "#C75B3A",
          600: "#B14A2E",
          700: "#8F3A23",
          800: "#6D2C1B",
          900: "#4B1E12",
        },
        sage: {
          DEFAULT: "#5A8A6E",
          light: "#7BA88D",
          dark: "#3F6B52",
          50: "#EFF5F1",
          100: "#D8E8DE",
          200: "#B0D1BB",
          300: "#88BA9A",
          400: "#6FA484",
          500: "#5A8A6E",
          600: "#477058",
          700: "#365642",
          800: "#243C2C",
          900: "#122216",
        },
        parchment: {
          DEFAULT: "#FDF8F3",
          light: "#FFFCF8",
          dark: "#F5EBE0",
          50: "#FFFCF8",
          100: "#FDF8F3",
          200: "#F9F0E6",
          300: "#F5EBE0",
          400: "#EDDFD0",
          500: "#E0CDB8",
        },
        espresso: {
          DEFAULT: "#3D2B1F",
          light: "#5C4636",
          dark: "#241710",
          50: "#F0EBE7",
          100: "#D8CCC4",
          200: "#B09A8C",
          300: "#886F5E",
          400: "#5C4636",
          500: "#3D2B1F",
          600: "#2E2017",
          700: "#1F150F",
        },
      },
      fontFamily: {
        serif: ['"Lora"', "Georgia", "serif"],
        sans: ['"Work Sans"', "system-ui", "sans-serif"],
        hand: ['"Nothing You Could Do"', "cursive"],
      },
      backgroundImage: {
        "parchment-texture":
          "radial-gradient(circle at 20% 30%, rgba(199,91,58,0.04) 0%, transparent 50%), radial-gradient(circle at 80% 70%, rgba(90,138,110,0.04) 0%, transparent 50%), linear-gradient(180deg, #FDF8F3 0%, #F9F0E6 100%)",
        "contour-lines":
          "repeating-linear-gradient(45deg, transparent, transparent 35px, rgba(199,91,58,0.03) 35px, rgba(199,91,58,0.03) 36px), repeating-linear-gradient(-45deg, transparent, transparent 35px, rgba(90,138,110,0.03) 35px, rgba(90,138,110,0.03) 36px)",
      },
      boxShadow: {
        card: "0 2px 8px rgba(61,43,31,0.06), 0 1px 3px rgba(61,43,31,0.04)",
        "card-hover": "0 8px 24px rgba(61,43,31,0.10), 0 2px 8px rgba(61,43,31,0.06)",
        warm: "0 4px 16px rgba(199,91,58,0.15)",
      },
      animation: {
        "fade-in": "fadeIn 0.6s ease-out forwards",
        "fade-in-up": "fadeInUp 0.6s ease-out forwards",
        "slide-in": "slideIn 0.4s ease-out forwards",
        "typing": "typing 1.5s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideIn: {
          "0%": { opacity: "0", transform: "translateX(-10px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        typing: {
          "0%, 100%": { opacity: "0.3" },
          "50%": { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};
