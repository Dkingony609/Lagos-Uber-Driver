import { defineConfig } from "vitest/config";
export default defineConfig({
  test: { include: ["tests/domain.test.ts"] },
  build: {
    rollupOptions: {
      output: {
        manualChunks: { three: ["three"], react: ["react", "react-dom"] },
      },
    },
  },
});
