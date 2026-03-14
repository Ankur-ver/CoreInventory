/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#0A0C0F',
          surface: '#111318',
          surface2: '#1A1D24',
          surface3: '#22262F',
        },
        border: {
          DEFAULT: '#2A2E38',
          strong: '#363C4A',
        },
        accent: {
          DEFAULT: '#4F8EF7',
          purple: '#7B5CEA',
          teal: '#00D4A8',
          orange: '#F7914F',
        },
        status: {
          success: '#4FF79A',
          warn: '#F7C04F',
          danger: '#F75F5F',
        },
        text: {
          primary: '#F0F2F7',
          secondary: '#8892A4',
          muted: '#4A5568',
        },
      },
      fontFamily: {
        head: ['Syne', 'sans-serif'],
        body: ['DM Sans', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '8px',
        lg: '12px',
        xl: '16px',
      },
    },
  },
  plugins: [],
};
