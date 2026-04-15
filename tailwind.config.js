/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: {
          base:     '#0F1117',
          surface:  '#1A1D27',
          elevated: '#22263A',
        },
        border: {
          default: '#2E3347',
        },
        text: {
          primary:   '#F0F2F7',
          secondary: '#9CA3B8',
          hint:      '#6B7280',
        },
        accent: {
          DEFAULT: '#93B4FA',
          icon:    '#4F8EF7',
        },
        success: '#34D399',
        warning: '#FBBF24',
        danger:  '#F87171',
      },
      fontFamily: {
        sans:  ['"DM Sans"', 'sans-serif'],
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        mono:  ['"DM Mono"', 'monospace'],
      },
      keyframes: {
        slideDown: {
          from: { opacity: '0', transform: 'translateY(-6px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'slide-down': 'slideDown 0.2s ease',
      },
    },
  },
  plugins: [],
}
