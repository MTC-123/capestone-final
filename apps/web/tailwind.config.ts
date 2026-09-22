import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        surface: "hsl(var(--surface))",
        "surface-2": "hsl(var(--surface-2))",
        muted: "hsl(var(--muted))",
        "muted-foreground": "hsl(var(--muted-foreground))",
        primary: "hsl(var(--primary))",
        "primary-foreground": "hsl(var(--primary-foreground))",
        "primary-muted": "hsl(var(--primary-muted))",
        success: "hsl(var(--success))",
        warning: "hsl(var(--warning))",
        danger: "hsl(var(--danger))",
        "success-muted": "hsl(var(--success-muted))",
        "success-foreground": "hsl(var(--success-foreground))",
        "warning-muted": "hsl(var(--warning-muted))",
        "warning-foreground": "hsl(var(--warning-foreground))",
        "danger-muted": "hsl(var(--danger-muted))",
        "danger-foreground": "hsl(var(--danger-foreground))",
        "accent-fire": "hsl(var(--accent-fire))",
        info: "hsl(var(--info))",
        "info-muted": "hsl(var(--info-muted))",
        "info-foreground": "hsl(var(--info-foreground))",

        "primary-scale": {
          50: "#f0fdf4",
          100: "#dcfce7",
          200: "#bbf7d0",
          300: "#86efac",
          400: "#4ade80",
          500: "#22c55e",
          600: "#16a34a",
          700: "#15803d",
          800: "#166534",
          900: "#14532d",
        },
      },
      fontSize: {
        "fluid-sm": "clamp(0.8125rem, 0.75rem + 0.2vw, 0.875rem)",
        "fluid-base": "clamp(0.875rem, 0.8rem + 0.25vw, 1rem)",
        "fluid-lg": "clamp(1rem, 0.9rem + 0.35vw, 1.125rem)",
        "fluid-xl": "clamp(1.125rem, 1rem + 0.5vw, 1.25rem)",
        "fluid-2xl": "clamp(1.25rem, 1.1rem + 0.75vw, 1.5rem)",
        "fluid-3xl": "clamp(1.5rem, 1.25rem + 1vw, 1.875rem)",
        "fluid-4xl": "clamp(1.875rem, 1.5rem + 1.5vw, 2.25rem)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      borderRadius: {
        lg: "calc(var(--radius) + 2px)",
        md: "var(--radius)",
        sm: "calc(var(--radius) - 4px)",
        xs: "calc(var(--radius) - 6px)",
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'slide-down': {
          from: { opacity: '0', transform: 'translateY(-8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-up-fade': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 200ms ease-out',
        'accordion-up': 'accordion-up 200ms ease-out',
        'slide-down': 'slide-down 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-up-fade': 'slide-up-fade 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'scale-in': 'scale-in 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
      },
      boxShadow: {
        "elev-1": "0 1px 3px hsl(220 40% 2% / 0.04), 0 4px 12px hsl(220 40% 2% / 0.06)",
        "elev-2": "0 2px 6px hsl(220 40% 2% / 0.06), 0 12px 32px hsl(220 40% 2% / 0.10)",
        "elev-3": "0 4px 12px hsl(220 40% 2% / 0.08), 0 24px 56px hsl(220 40% 2% / 0.14)",
        glass: "0 4px 30px hsl(0 0% 0% / 0.08), 0 1px 3px hsl(0 0% 0% / 0.04)",
        "inner-soft": "inset 0 1px 2px hsl(220 40% 2% / 0.06)",
        "glow-green": "0 0 20px hsl(145 72% 48% / 0.25)",
        "glow-red": "0 0 20px hsl(0 84% 60% / 0.25)",
      },
    },
  },
  plugins: [],
};

export default config;
