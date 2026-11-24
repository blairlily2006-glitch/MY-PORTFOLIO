import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const projectDir = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/MY-PORTFOLIO/' : '/',
  root: fileURLToPath(new URL('./src/', import.meta.url)),
  plugins: [react()],
  publicDir: fileURLToPath(new URL('./public/', import.meta.url)),
  server: { fs: { allow: [projectDir] } },
  build: { outDir: fileURLToPath(new URL('./dist/', import.meta.url)), emptyOutDir: true },
})
