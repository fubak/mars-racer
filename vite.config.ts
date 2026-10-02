import { defineConfig } from 'vitest/config'

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/mars-racer/' : '/',
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
  test: {
    environment: 'node',
  },
}))
