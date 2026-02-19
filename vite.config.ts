import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  const proxyTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:5003';
  const wsProxyTarget = env.VITE_WS_PROXY_TARGET || 'ws://localhost:8080';

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },

      proxy: mode === 'development'
        ? {
            '/api': {
              target: proxyTarget,
              changeOrigin: true,
              secure: false,
              rewrite: (path) => path.replace(/^\/api/, ''),
            },

            '/ws': {
              target: wsProxyTarget,
              ws: true,
              changeOrigin: true,
              secure: false,
            },
          }
        : undefined,
    },

    plugins: [react()],

    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },

    define: {
      __APP_ENV__: JSON.stringify(mode),
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0'),
      __APP_BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    },
  };
});
