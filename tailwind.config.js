/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        fg: 'var(--fg)',
        card: 'var(--card)',
        'card-fg': 'var(--card-fg)',
        primary: 'var(--primary)',
        'primary-fg': 'var(--primary-fg)',
        secondary: 'var(--secondary)',
        'secondary-fg': 'var(--secondary-fg)',
        muted: 'var(--muted)',
        'muted-fg': 'var(--muted-fg)',
        border: 'var(--border)',
        input: 'var(--input)',
      },
    },
  },
  plugins: [],
}
