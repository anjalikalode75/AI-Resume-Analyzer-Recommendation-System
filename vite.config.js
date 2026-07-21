import { defineConfig } from "vite";
import { resolve } from "path";

// Static multi-page Firebase app. All HTML files at project root are entry points.
export default defineConfig({
  server: { host: true, port: 8080 },
  preview: { host: true, port: 8080 },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        login: resolve(__dirname, "login.html"),
        signup: resolve(__dirname, "signup.html"),
        dashboard: resolve(__dirname, "dashboard.html"),
        profile: resolve(__dirname, "profile.html"),
        forgot: resolve(__dirname, "forgot-password.html"),
      },
    },
  },
});