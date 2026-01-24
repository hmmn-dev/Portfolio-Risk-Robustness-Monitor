import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/engine/**/*.test.ts'],
  },
  base: command === "build" ? "/Portfolio-Risk-Robustness-Monitor/" : "/",
}));
