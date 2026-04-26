/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: {
          base:     '#F0F2F7',
          surface:  '#FFFFFF',
          elevated: '#F8F9FC',
        },
        border: {
          default: '#E5E7EB',
          strong:  '#D1D5DB',
        },
        text: {
          primary:   '#1A1D35',
          secondary: '#6B7280',
          hint:      '#6B7280',
        },
        accent: {
          DEFAULT: '#5B5FC7',
          hover:   '#4B4FB7',
          light:   '#EEEEF9',
          text:    '#5B5FC7',
        },
        success: '#065F46',
        warning: '#B45309',
        danger:  '#DC2626',
        good:    '#059669',
        info:    '#3B82F6',
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
