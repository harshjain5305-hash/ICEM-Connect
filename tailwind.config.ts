import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{ts,tsx,js,jsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '1rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        // Design.md §4.1: Primary Brand Palette (Indira ICEM)
        primary: {
          DEFAULT: 'hsl(var(--primary))',       // #003C84 Indira Deep Navy
          hover: 'hsl(var(--primary-hover))',   // #1D59A3 Indira Royal Blue
          slate: 'hsl(var(--primary-slate))',   // #0F1E46 Indira Deep Slate
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',   // #EF4444 Crimson Red
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        // Design.md §4.2: Modern Mobility Accents
        accent: {
          DEFAULT: 'hsl(var(--accent))',         // #00A2A5 Electric Cyan-Teal
          foreground: 'hsl(var(--accent-foreground))',
        },
        cyan: {
          DEFAULT: 'hsl(var(--cyan))',           // #00A2A5 Electric Cyan-Teal
          light: 'hsl(var(--cyan-light))',       // #43CBD0
          foreground: 'hsl(var(--cyan-foreground))',
        },
        tangerine: {
          DEFAULT: 'hsl(var(--tangerine))',     // #E85C0D Warm Tangerine
          foreground: 'hsl(var(--tangerine-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        // Design.md §4.4: Semantic Colors
        success: {
          DEFAULT: 'hsl(var(--success))',       // #10B981 Emerald Green
          foreground: 'hsl(var(--success-foreground))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',       // #F59E0B Amber
          foreground: 'hsl(var(--warning-foreground))',
        },
        info: {
          DEFAULT: 'hsl(var(--info))',          // #00A2A5 Indira Cyan
          foreground: 'hsl(var(--info-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
