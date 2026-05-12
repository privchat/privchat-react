import { defineConfig } from 'vitest/config';

// No @vitejs/plugin-react here — vitest's built-in esbuild transforms .tsx
// using the `jsx: "react-jsx"` setting from tsconfig.json. The React plugin
// is only needed for HMR / Fast Refresh in real dev servers, which is the
// consuming app's concern (privchat-web), not this package.
export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: false,
  },
});
