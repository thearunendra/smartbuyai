import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // White-box tests (npm test / npm run test:coverage).
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{js,jsx}'],
      exclude: ['src/main.jsx', 'src/test/**', 'src/**/*.test.{js,jsx}'],
      reporter: ['text', 'text-summary', 'html', 'json-summary'],
      // White-box targets: the run fails if coverage drops below these.
      thresholds: { statements: 90, branches: 85, functions: 90, lines: 90 },
    },
  },
})
